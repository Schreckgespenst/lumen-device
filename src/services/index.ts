// Phase 2 stub layer. Every function resolves to empty data so the ported
// screens render without a backend. Phase 3 will replace these with
// @capacitor-community/sqlite calls, one module per backend route file.

import type {
  ChatMessageOut,
  ChatOut,
  FoodIn,
  FoodOut,
  MeasurementIn,
  MeasurementOut,
  MeasurementPatch,
  ProfilePatch,
  ProfileResponse,
  UserOut,
  UserSetup,
  WeightIn,
  WeightOut,
  WeightPatch,
} from '../types'

export const api = {
  // profile
  setup: (_data: UserSetup): Promise<UserOut | null> => Promise.resolve(null),
  getProfile: (): Promise<ProfileResponse | null> => Promise.resolve(null),
  patchProfile: (_data: ProfilePatch): Promise<UserOut | null> => Promise.resolve(null),

  // chat
  sendChat: (_message: string, _image_b64: string | null = null): Promise<ChatOut> =>
    Promise.resolve({ reply: '', follow_up_options: [], food_entries_added: 0 }),
  chatHistory: (): Promise<ChatMessageOut[]> => Promise.resolve([]),
  clearChat: (): Promise<null> => Promise.resolve(null),

  // food
  addFood: (_data: FoodIn): Promise<FoodOut | null> => Promise.resolve(null),
  listFood: (_date?: string): Promise<FoodOut[]> => Promise.resolve([]),
  deleteFood: (_id: number): Promise<null> => Promise.resolve(null),

  // weight
  addWeight: (_data: WeightIn): Promise<WeightOut | null> => Promise.resolve(null),
  listWeight: (): Promise<WeightOut[]> => Promise.resolve([]),
  patchWeight: (_id: number, _data: WeightPatch): Promise<WeightOut | null> =>
    Promise.resolve(null),
  deleteWeight: (_id: number): Promise<null> => Promise.resolve(null),

  // measurements
  addMeasurement: (_data: MeasurementIn): Promise<MeasurementOut | null> =>
    Promise.resolve(null),
  listMeasurements: (): Promise<MeasurementOut[]> => Promise.resolve([]),
  patchMeasurement: (_id: number, _data: MeasurementPatch): Promise<MeasurementOut | null> =>
    Promise.resolve(null),
  deleteMeasurement: (_id: number): Promise<null> => Promise.resolve(null),
}

export function todayIso(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}
