// SPDX-License-Identifier: GPL-3.0-only
// M18 mapping and protocol usage follow ibanks42/opendeck-m18.

use std::{env, io::Write, time::Duration};

use data_url::DataUrl;
use image::{DynamicImage, RgbaImage};
use mirajazz::{
    device::{Device, DeviceQuery, list_devices},
    error::MirajazzError,
    state::DeviceStateUpdate,
    types::{DeviceInput, ImageFormat, ImageMirroring, ImageMode, ImageRotation},
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use tokio::{
    io::{AsyncBufReadExt, BufReader},
    time::interval,
};

const VID: u16 = 0x5548;
const PID: u16 = 0x1000;
const USAGE_PAGE: u16 = 0xffa0;
const USAGE: u16 = 1;
const PROTOCOL_VERSION: usize = 3;
const STATE_KEY_COUNT: usize = 20;
const LCD_KEY_COUNT: u8 = 15;
const BTN_LEFT: u8 = 0x25;
const BTN_MIDDLE: u8 = 0x30;
const BTN_RIGHT: u8 = 0x31;
const QUERY: DeviceQuery = DeviceQuery::new(USAGE_PAGE, USAGE, VID, PID);

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum Command {
    SetImage { id: u64, key: u8, image: String },
    SetBrightness { id: u64, brightness: u8 },
    Shutdown { id: u64 },
}

#[derive(Serialize)]
struct ProbeDevice {
    vendor_id: u16,
    product_id: u16,
    serial_number: Option<String>,
    name: String,
}

#[tokio::main]
async fn main() {
    if let Err(error) = run().await {
        emit(json!({ "type": "error", "message": error.to_string() }));
        std::process::exit(1);
    }
}

async fn run() -> Result<(), Box<dyn std::error::Error>> {
    let candidates = list_devices(&[QUERY]).await?;
    if env::args().any(|argument| argument == "--probe") {
        let devices: Vec<_> = candidates
            .into_iter()
            .map(|device| ProbeDevice {
                vendor_id: device.vendor_id,
                product_id: device.product_id,
                serial_number: device.serial_number.clone(),
                name: device.name.clone(),
            })
            .collect();
        emit(json!({ "type": "probe", "devices": devices }));
        return Ok(());
    }

    let candidate = candidates
        .into_iter()
        .next()
        .ok_or("VSD Inside M18 (0x5548:0x1000, usage 0xFFA0:1) was not found")?;
    let name = candidate.name.clone();
    let device = Device::connect(&candidate, PROTOCOL_VERSION, STATE_KEY_COUNT, 0).await?;
    let reader = device.get_reader(process_input);
    emit(json!({ "type": "ready", "name": name, "vid": VID, "pid": PID }));

    let mut input = BufReader::new(tokio::io::stdin()).lines();
    let mut keepalive = interval(Duration::from_secs(10));
    loop {
        tokio::select! {
            line = input.next_line() => {
                let Some(line) = line? else { break; };
                match serde_json::from_str::<Command>(&line) {
                    Ok(Command::SetImage { id, key, image }) => {
                        respond(id, set_image(&device, key, &image).await);
                    }
                    Ok(Command::SetBrightness { id, brightness }) => {
                        let result = if brightness <= 100 {
                            device.set_brightness(brightness).await
                        } else { Err(MirajazzError::BadData) };
                        respond(id, result);
                    }
                    Ok(Command::Shutdown { id }) => {
                        respond(id, device.shutdown().await);
                        break;
                    }
                    Err(error) => emit(json!({ "type": "error", "message": format!("invalid command: {error}") })),
                }
            }
            updates = reader.read(None) => {
                for update in updates? {
                    match update {
                        DeviceStateUpdate::ButtonDown(key) if key < 18 => emit(json!({ "type": "key_down", "key": key })),
                        DeviceStateUpdate::ButtonUp(key) if key < 18 => emit(json!({ "type": "key_up", "key": key })),
                        _ => {}
                    }
                }
            }
            _ = keepalive.tick() => device.keep_alive().await?,
        }
    }
    Ok(())
}

async fn set_image(device: &Device, key: u8, data_url: &str) -> Result<(), MirajazzError> {
    if key >= LCD_KEY_COUNT {
        return Err(MirajazzError::BadData);
    }
    let image = decode_image(data_url)?;
    device
        .set_button_image(device_key(key), image_format(), image)
        .await?;
    device.flush().await
}

fn decode_image(value: &str) -> Result<DynamicImage, MirajazzError> {
    let url = DataUrl::process(value).map_err(|_| MirajazzError::BadData)?;
    let (bytes, _) = url.decode_to_vec().map_err(|_| MirajazzError::BadData)?;
    match url.mime_type().subtype.as_str() {
        "svg+xml" => rasterize_svg(&bytes),
        "jpeg" | "jpg" => image::load_from_memory_with_format(&bytes, image::ImageFormat::Jpeg)
            .map_err(MirajazzError::ImageError),
        "png" => image::load_from_memory_with_format(&bytes, image::ImageFormat::Png)
            .map_err(MirajazzError::ImageError),
        _ => Err(MirajazzError::BadData),
    }
}

fn rasterize_svg(bytes: &[u8]) -> Result<DynamicImage, MirajazzError> {
    let options = resvg::usvg::Options::default();
    let tree = resvg::usvg::Tree::from_data(bytes, &options).map_err(|_| MirajazzError::BadData)?;
    let size = tree.size().to_int_size();
    let mut pixmap =
        resvg::tiny_skia::Pixmap::new(size.width(), size.height()).ok_or(MirajazzError::BadData)?;
    resvg::render(
        &tree,
        resvg::tiny_skia::Transform::identity(),
        &mut pixmap.as_mut(),
    );
    let rgba = RgbaImage::from_raw(size.width(), size.height(), pixmap.take())
        .ok_or(MirajazzError::BadData)?;
    Ok(DynamicImage::ImageRgba8(rgba))
}

fn process_input(input: u8, state: u8) -> Result<DeviceInput, MirajazzError> {
    let key = match input {
        0 => None,
        1..=15 => Some((input - 1) as usize),
        BTN_LEFT => Some(15),
        BTN_MIDDLE => Some(16),
        BTN_RIGHT => Some(17),
        _ => return Err(MirajazzError::BadData),
    };
    let mut states = vec![false; STATE_KEY_COUNT];
    if state != 0
        && let Some(key) = key
    {
        states[key] = true;
    }
    Ok(DeviceInput::ButtonStateChange(states))
}

fn device_key(key: u8) -> u8 {
    let row = key / 5;
    let column = key % 5;
    (2 - row) * 5 + column
}

fn image_format() -> ImageFormat {
    ImageFormat {
        mode: ImageMode::JPEG,
        size: (64, 64),
        rotation: ImageRotation::Rot180,
        mirror: ImageMirroring::Both,
    }
}

fn respond(id: u64, result: Result<(), MirajazzError>) {
    match result {
        Ok(()) => emit(json!({ "type": "ack", "id": id })),
        Err(error) => emit(json!({ "type": "error", "id": id, "message": error.to_string() })),
    }
}

fn emit(value: serde_json::Value) {
    println!("{value}");
    let _ = std::io::stdout().flush();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_lcd_rows_to_device_order() {
        assert_eq!(device_key(0), 10);
        assert_eq!(device_key(4), 14);
        assert_eq!(device_key(5), 5);
        assert_eq!(device_key(10), 0);
        assert_eq!(device_key(14), 4);
    }

    #[test]
    fn maps_all_physical_inputs() {
        for raw in 1..=15 {
            assert!(matches!(
                process_input(raw, 1),
                Ok(DeviceInput::ButtonStateChange(_))
            ));
        }
        for raw in [BTN_LEFT, BTN_MIDDLE, BTN_RIGHT] {
            assert!(matches!(
                process_input(raw, 1),
                Ok(DeviceInput::ButtonStateChange(_))
            ));
        }
        assert!(process_input(0xff, 1).is_err());
    }
}
