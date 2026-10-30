declare module 'pagedjs' {
  export class Previewer {
    preview(content?: Node | string, stylesheets?: (string | Record<string, string>)[], renderTo?: HTMLElement): Promise<{ total: number; performance: number }>
  }
}
