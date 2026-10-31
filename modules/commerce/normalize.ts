import type {State} from './types';
/** Additive state upgrade. Existing owner data and history are preserved. */
export function normalizeState(s:State):State{return {...s,zones:s.zones||[],carriers:s.carriers||[],returns:s.returns||[],invoices:s.invoices||[],carts:s.carts||[]};}
