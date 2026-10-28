// POS errors must not include customer details, payment data or request bodies.
export const sentryDataCollection = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [] as [],
  urlQueryParams: false,
  graphQL: { document: false, variables: false },
  genAI: { inputs: false, outputs: false },
  databaseQueryData: false,
  queues: false,
  stackFrameVariables: false,
  frameContextLines: 0,
} as const;
