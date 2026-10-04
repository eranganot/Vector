/** Errors the domain raises. `code` is stable and stored in audit rows for denied attempts. */
export class DomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export const illegal = (machine: string, from: string, command: string) =>
  new DomainError("IllegalTransition", `${machine}: '${command}' is not allowed from '${from}'`);
