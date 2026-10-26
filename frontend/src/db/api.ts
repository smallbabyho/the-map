// 화면 코드는 데이터 함수를 반드시 여기서 import 한다.
// .env 에 Supabase 키가 있으면 진짜(supabase.ts), 없으면 브라우저 저장 가짜 데이터(mock.ts).
// impl 의 타입이 typeof mock 이라서, supabase.ts 의 함수 이름 · 입력 · 반환 형태가 mock 과 다르면 빌드가 실패한다.

import { hasSupabase } from '../lib/supabase'
import * as mock from './mock'
import * as real from './supabase'

const impl: typeof mock = hasSupabase ? real : mock

export const getCurrentUser = impl.getCurrentUser
export const getMyMaps = impl.getMyMaps
export const getMap = impl.getMap
export const saveMap = impl.saveMap
export const deleteMap = impl.deleteMap
export const savePin = impl.savePin
export const deletePin = impl.deletePin
export const saveLeg = impl.saveLeg
export const deleteLeg = impl.deleteLeg
export const uploadPinPhoto = impl.uploadPinPhoto
export const uploadAvatar = impl.uploadAvatar
export const updateMyProfile = impl.updateMyProfile
export const getMapCollab = impl.getMapCollab
export const createMapInvite = impl.createMapInvite
export const getMapInvitePreview = impl.getMapInvitePreview
export const joinMapByInvite = impl.joinMapByInvite
export const removeMapEditor = impl.removeMapEditor
export const getMeetups = impl.getMeetups
export const getMeetup = impl.getMeetup
export const saveMeetup = impl.saveMeetup
export const joinMeetup = impl.joinMeetup
export const leaveMeetup = impl.leaveMeetup
export const setMeetupStatus = impl.setMeetupStatus
export const getUser = impl.getUser
export const getMeetupComments = impl.getMeetupComments
export const addMeetupComment = impl.addMeetupComment
export const deleteMeetupComment = impl.deleteMeetupComment
export const submitReport = impl.submitReport
export const setBlocked = impl.setBlocked
export const getBlockedUsers = impl.getBlockedUsers
export const adminListReports = impl.adminListReports
export const adminResolveReport = impl.adminResolveReport
export const getProfile = impl.getProfile
export const saveProfileDeco = impl.saveProfileDeco
export const copyMap = impl.copyMap
export const getPublicMaps = impl.getPublicMaps
export const getMonthlyRanking = impl.getMonthlyRanking
export const adminGetStats = impl.adminGetStats
export const adminListUsers = impl.adminListUsers
export const adminUpdateUser = impl.adminUpdateUser
export const adminDeleteUser = impl.adminDeleteUser
