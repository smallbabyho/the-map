import type { PlaceSearchResult } from './placeSearch'

// 카카오 키가 없을 때 검색 체험용 샘플. externalId 가 'sample-' 로 시작해서 실제 카카오 ID 와 겹치지 않는다.
export const SAMPLE_PLACES: PlaceSearchResult[] = [
  { externalId: 'sample-1', name: '성수 카페거리', lat: 37.5446, lng: 127.0559, address: '서울 성동구 성수동2가', category: '카페' },
  { externalId: 'sample-2', name: '서울숲', lat: 37.5444, lng: 127.0374, address: '서울 성동구 뚝섬로 273', category: '공원' },
  { externalId: 'sample-3', name: '연남동 경의선숲길', lat: 37.5600, lng: 126.9230, address: '서울 마포구 연남동', category: '공원' },
  { externalId: 'sample-4', name: '망원시장', lat: 37.5560, lng: 126.9060, address: '서울 마포구 포은로8길 14', category: '시장' },
  { externalId: 'sample-5', name: '익선동 한옥거리', lat: 37.5741, lng: 126.9895, address: '서울 종로구 익선동', category: '관광명소' },
  { externalId: 'sample-6', name: '경복궁', lat: 37.5796, lng: 126.9770, address: '서울 종로구 사직로 161', category: '관광명소' },
  { externalId: 'sample-7', name: '북촌 한옥마을', lat: 37.5826, lng: 126.9831, address: '서울 종로구 계동길 37', category: '관광명소' },
  { externalId: 'sample-8', name: '남산서울타워', lat: 37.5512, lng: 126.9882, address: '서울 용산구 남산공원길 105', category: '관광명소' },
  { externalId: 'sample-9', name: '이태원 베이커리 골목', lat: 37.5345, lng: 126.9946, address: '서울 용산구 이태원동', category: '빵집 베이커리' },
  { externalId: 'sample-10', name: '을지로 노가리 골목', lat: 37.5660, lng: 126.9920, address: '서울 중구 을지로13길', category: '술집' },
  { externalId: 'sample-11', name: '광장시장', lat: 37.5701, lng: 126.9996, address: '서울 종로구 창경궁로 88', category: '시장 맛집' },
  { externalId: 'sample-12', name: '한남동 카페 골목', lat: 37.5378, lng: 127.0010, address: '서울 용산구 한남동', category: '카페' },
  { externalId: 'sample-13', name: '잠실 롯데월드몰', lat: 37.5133, lng: 127.1028, address: '서울 송파구 올림픽로 300', category: '쇼핑' },
  { externalId: 'sample-14', name: '여의도 한강공원', lat: 37.5284, lng: 126.9340, address: '서울 영등포구 여의동로 330', category: '공원' },
  { externalId: 'sample-15', name: '문래 창작촌', lat: 37.5145, lng: 126.8960, address: '서울 영등포구 문래동', category: '예술 카페' },
  { externalId: 'sample-16', name: '성수 베이커리 카페', lat: 37.5420, lng: 127.0560, address: '서울 성동구 연무장길', category: '빵집 베이커리 카페' },
]
