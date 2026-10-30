export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export const fail = (message: string, status = 400) => json({ error: message }, status);

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// Wrap a handler so thrown HttpErrors become clean JSON responses.
export const handle =
  (fn: (req: Request) => Promise<Response>) =>
  async (req: Request): Promise<Response> => {
    try {
      return await fn(req);
    } catch (e) {
      if (e instanceof HttpError) return fail(e.message, e.status);
      console.error(e);
      return fail('Something went wrong on the server', 500);
    }
  };
