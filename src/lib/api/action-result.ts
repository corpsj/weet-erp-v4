export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; message: string };

export function actionError(message: string): ActionResult<never> {
  return { ok: false, message };
}

export function actionSuccess<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}
