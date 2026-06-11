// Service facade. UI imports `api` and `todayIso` from here; this file just
// composes the per-route modules so each table has a dedicated file
// (matches the backend/routes/ split one-for-one).

import * as profile from './profile'
import * as food from './food'
import * as weight from './weight'
import * as measurements from './measurements'
import * as chat from './chat'

export { initDb } from './db'

export const api = {
  // profile
  setup: profile.setup,
  getProfile: profile.getProfile,
  patchProfile: profile.patchProfile,

  // chat
  sendChat: chat.sendChat,
  chatHistory: chat.chatHistory,
  clearChat: chat.clearChat,
  getChatSettings: chat.getChatSettings,
  setChatSettings: chat.setChatSettings,
  runDailyClearIfDue: chat.runDailyClearIfDue,

  // food
  addFood: food.addFood,
  listFood: food.listFood,
  deleteFood: food.deleteFood,

  // weight
  addWeight: weight.addWeight,
  listWeight: weight.listWeight,
  patchWeight: weight.patchWeight,
  deleteWeight: weight.deleteWeight,

  // measurements
  addMeasurement: measurements.addMeasurement,
  listMeasurements: measurements.listMeasurements,
  patchMeasurement: measurements.patchMeasurement,
  deleteMeasurement: measurements.deleteMeasurement,
}

export function todayIso(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}
