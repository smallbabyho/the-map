// 화면은 로그인 관련 기능을 반드시 여기서 import 한다.
// Supabase 버전이 준비되면 아래 './mock' 을 진짜 구현으로 바꾼다 (함수 이름·형태는 그대로).
export { signUp, signIn, signOut, onAuthChange, DEMO_ACCOUNT } from './impl'
export { CaptchaWidget } from './CaptchaWidget'
export { useCurrentUser } from './useCurrentUser'
