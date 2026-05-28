export function extractProjectArray<T = any>(payload: any, keys: string[] = []): T[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.data?.results)) return payload.data.results;

  for (const key of keys) {
    if (Array.isArray(payload?.[key])) return payload[key];
    if (Array.isArray(payload?.data?.[key])) return payload.data[key];
    if (Array.isArray(payload?.result?.[key])) return payload.result[key];
    if (Array.isArray(payload?.results?.[key])) return payload.results[key];
  }

  return [];
}

export function extractProjectEntity<T = any>(payload: any, keys: string[] = []): T | undefined {
  for (const key of keys) {
    const direct = payload?.[key];
    const nestedData = payload?.data?.[key];
    const nestedResult = payload?.result?.[key];

    if (direct && typeof direct === 'object' && !Array.isArray(direct)) return direct;
    if (nestedData && typeof nestedData === 'object' && !Array.isArray(nestedData)) return nestedData;
    if (nestedResult && typeof nestedResult === 'object' && !Array.isArray(nestedResult)) return nestedResult;
  }

  if (payload?.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) return payload.data;
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) return payload;

  return undefined;
}

export function extractProjectBoard(payload: any): Record<string, any[]> {
  const board =
    payload?.board ??
    payload?.data?.board ??
    payload?.columns ??
    payload?.data?.columns ??
    payload?.kanban ??
    payload?.data?.kanban ??
    payload;

  return board && typeof board === 'object' && !Array.isArray(board) ? board : {};
}
