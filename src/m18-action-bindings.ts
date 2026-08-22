import type { M18ActionSpec } from "./action-catalog.js";
import type { DeckController, FixedIconSource } from "./controller.js";
import type { Binding } from "./m18-bindings.js";

const joystickIcons: Record<string, FixedIconSource> = {
  up: { kind: "local", keycapId: "BRCH" },
  down: { kind: "builtin", name: "sidebar" },
  left: { kind: "builtin", name: "back" },
  right: { kind: "builtin", name: "forward" }
};

export function createM18Binding(controller: DeckController, spec: M18ActionSpec): Binding {
  switch (spec.kind) {
    case "agent":
      return {
        register: (action) => controller.registerAgent(spec.slot, action),
        unregister: (action) => controller.unregisterAgent(action),
        down: () => controller.sendAgent(spec.slot, 1),
        up: () => controller.sendAgent(spec.slot, 0)
      };
    case "joystick":
      return {
        register: (action) => controller.registerFixedAction(spec.id, action, joystickIcons[spec.direction]!),
        unregister: (action) => controller.unregisterFixedAction(action),
        down: () => controller.sendJoystick(spec.direction, 1),
        up: () => controller.sendJoystick(spec.direction, 0)
      };
    case "encoder":
      return {
        register: (action) => controller.registerFixedAction(spec.id, action, { kind: "local", keycapId: "MIND+" }),
        unregister: (action) => controller.unregisterFixedAction(action),
        down: () => controller.sendEncoder(1),
        up: () => controller.sendEncoder(0)
      };
    case "host-toggle":
      return {
        register: (action) => controller.registerHostToggle(action),
        unregister: (action) => controller.unregisterHostToggle(action),
        down: () => controller.toggleTargetHost()
      };
    case "usage-limit":
      return {
        register: (action) => controller.registerUsageLimit(action, "auto"),
        unregister: (action) => controller.unregisterUsageLimit(action),
        down: async () => {}
      };
    case "usage-overview":
      return {
        register: (action) => controller.registerUsageOverview(action),
        unregister: (action) => controller.unregisterUsageOverview(action),
        down: async () => {}
      };
    case "rate-limit-reset":
      return createRateLimitResetBinding(controller);
    case "keycap":
      if (spec.keycapId === "MIC") {
        let registeredAction: Parameters<NonNullable<Binding["register"]>>[0] | undefined;
        return {
          register: (action) => {
            registeredAction = action;
            controller.registerFixedAction(spec.id, action, { kind: "builtin", name: "voice" });
          },
          unregister: (action) => {
            if (registeredAction?.id === action.id) registeredAction = undefined;
            controller.unregisterFixedAction(action);
          },
          down: () => {
            if (registeredAction) controller.pulseVoiceAction(registeredAction);
            return controller.startM18VoiceConversation();
          }
        };
      }
      return {
        register: (action) => controller.registerFixedAction(spec.id, action, { kind: "local", keycapId: spec.keycapId }),
        unregister: (action) => controller.unregisterFixedAction(action),
        down: () => controller.runKeycap(spec.keycapId)
      };
  }
}

function createRateLimitResetBinding(controller: DeckController): Binding {
  let actionId: string | undefined;
  return {
    register: (action) => {
      actionId = action.id;
      controller.registerRateLimitReset(action);
    },
    unregister: (action) => {
      controller.unregisterRateLimitReset(action);
      if (actionId === action.id) actionId = undefined;
    },
    down: async () => {
      if (actionId) controller.beginRateLimitReset({ id: actionId });
    },
    up: async () => {
      if (actionId) await controller.finishRateLimitReset({ id: actionId });
    }
  };
}
