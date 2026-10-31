export interface ProblemFieldError {
  field: string;
  code: string;
}

export interface ApiProblemInit {
  status: number;
  code: string;
  title: string;
  detail?: string | undefined;
  errors?: ProblemFieldError[] | undefined;
}

/** Erro `application/problem+json` da API, com código estável ([project/api-03]). */
export class ApiProblem extends Error {
  readonly status: number;
  readonly code: string;
  readonly title: string;
  readonly detail: string | undefined;
  readonly errors: ProblemFieldError[];

  constructor(init: ApiProblemInit) {
    super(init.title);
    this.name = 'ApiProblem';
    this.status = init.status;
    this.code = init.code;
    this.title = init.title;
    this.detail = init.detail;
    this.errors = init.errors ?? [];
  }
}
