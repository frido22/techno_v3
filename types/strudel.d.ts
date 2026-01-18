declare module "@strudel/web" {
  export function initStrudel(): Promise<void>;
  export function evaluate(code: string): Promise<void>;
  export function hush(): void;
}
