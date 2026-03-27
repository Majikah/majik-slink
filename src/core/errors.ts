// ─── Error types ─────────────────────────────────────────────────────────────

export class MajikSLinkError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "MajikSLinkError";
  }
}

export class MajikSLinkValidationError extends MajikSLinkError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = "MajikSLinkValidationError";
  }
}

export class MajikSLinkSigningError extends MajikSLinkError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = "MajikSLinkSigningError";
  }
}

export class MajikSLinkSerializationError extends MajikSLinkError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = "MajikSLinkSerializationError";
  }
}
