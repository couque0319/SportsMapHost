// frontend/src/components/FacilityMap.tsx
import { useEffect, useRef } from "react";

type KakaoLatLng = {
  getLat(): number;
  getLng(): number;
};

type KakaoLatLngBounds = {
  extend(latlng: KakaoLatLng): void;
};

type KakaoMapOptions = {
  center: KakaoLatLng;
  level: number;
};

type KakaoMap = {
  panTo(latlng: KakaoLatLng): void;
  setBounds(bounds: KakaoLatLngBounds): void;
};

type KakaoMarkerOptions = {
  position: KakaoLatLng;
  map?: KakaoMap;
};

type KakaoMarker = {
  setMap(map: KakaoMap | null): void;
};

type KakaoInfoWindowOptions = {
  content: string;
};

type KakaoInfoWindow = {
  open(map: KakaoMap, marker: KakaoMarker): void;
};

type KakaoEvent = {
  addListener(target: KakaoMarker, type: string, handler: () => void): void;
};

type KakaoMapsNamespace = {
  LatLng: new (lat: number, lng: number) => KakaoLatLng;
  LatLngBounds: new () => KakaoLatLngBounds;
  Map: new (container: HTMLElement, options: KakaoMapOptions) => KakaoMap;
  Marker: new (options: KakaoMarkerOptions) => KakaoMarker;
  InfoWindow: new (options: KakaoInfoWindowOptions) => KakaoInfoWindow;
  event: KakaoEvent;
  load(callback: () => void): void;
};

type KakaoNamespace = {
  maps: KakaoMapsNamespace;
};

declare global {
  interface Window {
    kakao?: KakaoNamespace;
  }
}

export type Facility = {
  id: number;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  type?: string;
};

type FacilityMapProps = {
  facilities: Facility[];
  height?: string;
};

export default function FacilityMap({
  facilities,
  height = "600px",
}: FacilityMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<KakaoMap | null>(null);
  const markersRef = useRef<KakaoMarker[]>([]);

  // 디버그 로그: 컴포넌트로 들어오는 데이터 확인
  useEffect(() => {
    // lat/lng 있는 애들만 한 번 찍어보자
    const withCoords = facilities.filter(
      (f) => f.lat !== null && f.lng !== null
    );
    console.log(
      "[FacilityMap] 시설 개수:",
      facilities.length,
      "좌표 있는 시설:",
      withCoords.length,
      "샘플:",
      withCoords.slice(0, 3)
    );
  }, [facilities]);

  // 1) Kakao SDK 로드 + 지도 생성 (처음 한 번만)
  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current) return;

    const initMap = () => {
      const kakao = window.kakao;
      if (!kakao || !mapContainerRef.current) return;

      const withCoords = facilities.filter(
        (f) => f.lat !== null && f.lng !== null
      );

      const centerLat = withCoords[0]?.lat ?? 37.5665;
      const centerLng = withCoords[0]?.lng ?? 126.978;
      console.log(
        "[FacilityMap] 지도 초기화, 중심:",
        centerLat,
        centerLng,
        "좌표 있는 시설:",
        withCoords.length
      );

      const center = new kakao.maps.LatLng(centerLat, centerLng);

      const options: KakaoMapOptions = {
        center,
        level: 5,
      };

      mapRef.current = new kakao.maps.Map(mapContainerRef.current, options);
    };

    const existingScript = document.getElementById(
      "kakao-map-sdk"
    ) as HTMLScriptElement | null;

    if (!existingScript) {
      const script = document.createElement("script");
      script.id = "kakao-map-sdk";
      script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${
        import.meta.env.VITE_KAKAO_MAP_KEY
      }&autoload=false`;
      script.onload = () => {
        console.log("[FacilityMap] Kakao SDK 로드 완료");
        const kakao = window.kakao;
        if (!kakao) return;
        kakao.maps.load(initMap);
      };
      document.head.appendChild(script);
    } else {
      const kakao = window.kakao;
      if (!kakao) return;
      kakao.maps.load(initMap);
    }
  }, [facilities]);

  // 2) facilities 바뀔 때마다 마커 다시 그리기
  useEffect(() => {
    const kakao = window.kakao;
    const map = mapRef.current;

    if (!kakao || !map) {
      console.log(
        "[FacilityMap] 마커 갱신 스킵 - kakao 또는 map 없음",
        !!kakao,
        !!map
      );
      return;
    }

    // 이전 마커 제거
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    const bounds = new kakao.maps.LatLngBounds();

    const withCoords = facilities.filter(
      (f) => f.lat !== null && f.lng !== null
    );
    console.log("[FacilityMap] 마커 찍을 대상 개수:", withCoords.length);

    withCoords.forEach((facility) => {
      const position = new kakao.maps.LatLng(facility.lat!, facility.lng!);

      const markerOptions: KakaoMarkerOptions = {
        position,
        map,
      };
      const marker = new kakao.maps.Marker(markerOptions);

      const infoContent = `
        <div style="padding:8px 12px;font-size:13px;">
          <div style="font-weight:bold;margin-bottom:4px;">${facility.name}</div>
          <div>${facility.address ?? ""}</div>
        </div>
      `;

      const infoOptions: KakaoInfoWindowOptions = {
        content: infoContent,
      };
      const infowindow = new kakao.maps.InfoWindow(infoOptions);

      kakao.maps.event.addListener(marker, "click", () => {
        infowindow.open(map, marker);
        map.panTo(position);
      });

      markersRef.current.push(marker);
      bounds.extend(position);
    });

    if (markersRef.current.length > 0) {
      map.setBounds(bounds);
    }
  }, [facilities]);

  return (
    <div
      ref={mapContainerRef}
      style={{
        width: "100%",
        height,
        borderRadius: "16px",
        overflow: "hidden",
      }}
    />
  );
}
