export const renderResult = (jsonOutput: boolean, payload: unknown): void => {
  if (jsonOutput) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  if (Array.isArray(payload)) {
    for (const item of payload) {
      console.log(JSON.stringify(item));
    }
    return;
  }

  console.log(JSON.stringify(payload, null, 2));
};
