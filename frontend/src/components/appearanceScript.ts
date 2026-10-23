// 서버(app/layout.tsx)에서도 읽는 값이라 'use client' 를 붙이지 않는다.

export const APPEARANCE_STORAGE_KEY = 'the-map:appearance'
/** 일출·일몰 계산 기준 위치: 서울 */
export const SUN_BASE = { lat: 37.5665, lng: 126.978 }

/**
 * 첫 화면이 그려지기 전에 <html data-mode> 를 정하는 스크립트 (밤에 흰 화면이 번쩍이지 않게).
 * app/layout.tsx 의 <head> 에 그대로 넣는다. appearance.ts 의 sunTimes() 와 같은 계산을 문자열로 담았다.
 */
export const EARLY_APPEARANCE_SCRIPT = `(function(){try{var p=localStorage.getItem('${APPEARANCE_STORAGE_KEY}');var m=p==='light'||p==='dark'?p:null;if(!m){var r=Math.PI/180,d=new Date(),lat=${SUN_BASE.lat},lng=${SUN_BASE.lng};var no=new Date(d.getFullYear(),d.getMonth(),d.getDate(),12);var n=Math.round(no.getTime()/864e5+2440587.5-2451545+0.0008);var j=n-lng/360;var M=(357.5291+0.98560028*j)%360;var C=1.9148*Math.sin(M*r)+0.02*Math.sin(2*M*r)+0.0003*Math.sin(3*M*r);var L=(M+C+180+102.9372)%360;var t=2451545+j+0.0053*Math.sin(M*r)-0.0069*Math.sin(2*L*r);var s=Math.sin(L*r)*Math.sin(23.4397*r);var c=(Math.sin(-0.833*r)-Math.sin(lat*r)*s)/(Math.cos(lat*r)*Math.cos(Math.asin(s)));m='light';if(c>=-1&&c<=1){var w=Math.acos(c)/r/360;var up=(t-w-2440587.5)*864e5,down=(t+w-2440587.5)*864e5,now=d.getTime();m=now>=up&&now<down?'light':'dark'}}document.documentElement.dataset.mode=m}catch(e){}})()`
