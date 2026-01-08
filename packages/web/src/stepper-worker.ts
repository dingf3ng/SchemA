import { parse, typeCheck, Stepper } from '@schema/core';

let stepper: Stepper | null = null;

self.onmessage = async (event: MessageEvent) => {
  const { type, payload } = event.data;

  try {
    switch (type) {
      case 'initialize': {
        const { code } = payload;

        // Parse and type check
        const ast = parse(code);
        typeCheck(ast);

        // Create stepper and initialize
        stepper = new Stepper();
        stepper.initialize(ast);

        // Send initial state
        const state = stepper.getCurrentState();
        self.postMessage({ type: 'state', payload: state });
        break;
      }

      case 'step': {
        if (!stepper) {
          self.postMessage({
            type: 'error',
            payload: { message: 'Stepper not initialized' }
          });
          return;
        }

        const state = stepper.step();
        self.postMessage({ type: 'state', payload: state });
        break;
      }

      case 'continue': {
        if (!stepper) {
          self.postMessage({
            type: 'error',
            payload: { message: 'Stepper not initialized' }
          });
          return;
        }

        const state = stepper.continue();
        self.postMessage({ type: 'state', payload: state });
        break;
      }

      case 'reset': {
        if (!stepper) {
          self.postMessage({
            type: 'error',
            payload: { message: 'Stepper not initialized' }
          });
          return;
        }

        stepper.reset();
        const state = stepper.getCurrentState();
        self.postMessage({ type: 'state', payload: state });
        break;
      }

      default:
        console.warn('Unknown message type:', type);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    self.postMessage({
      type: 'error',
      payload: { message: errorMessage }
    });
  }
};

export {};
