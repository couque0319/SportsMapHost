/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Home, MapPin } from "lucide-react";

// ----------------- 상수 -----------------
const regions = [
  "서울",
  "부산",
  "대구",
  "인천",
  "광주",
  "대전",
  "울산",
  "세종",
  "경기",
  "강원",
  "충북",
  "충남",
  "전북",
  "전남",
  "경북",
  "경남",
  "제주",
] as const;

type Region = (typeof regions)[number];

type FacilityCategory = "all" | "public" | "leisure" | "private";

// 백엔드에서 내려오는 시설 타입
type Facility = {
  id: number;
  name: string;
  address: string | null;
  lat: number | null;
  lon: number | null;
  sido: string | null;
  sigungu: string | null;
  phone: string | null;
  is_public: boolean | null;
  type: string | null; // 예: "레저스포츠", "공공체육시설", ...
};

type FacilityListResponse = {
  items: Facility[];
  page: number;
  pageSize: number;
  total: number;
};

// ----------------- 헬퍼 함수 -----------------

// 카테고리 판별
const getFacilityCategory = (facility: Facility): FacilityCategory => {
  const type = (facility.type ?? "").trim();

  if (type.includes("레저") || type.includes("스포츠") || type.includes("레저스포츠")) {
    return "leisure";
  }

  // 백엔드에서 is_public 또는 type을 기반으로 공공/민간 구분
  if (facility.is_public || type.includes("공공") || type.includes("공공체육")) {
    return "public";
  }

  // 나머지는 민간시설로 처리
  return "private";
};

// 리스트 태그에 쓸 라벨
const getFacilityTagLabel = (facility: Facility) => {
  const category = getFacilityCategory(facility);

  switch (category) {
    case "public":
      return "공공체육시설";
    case "leisure":
      return "레저스포츠";
    case "private":
      return "민간시설";
    default:
      return "시설";
  }
};

// 태그 색상 클래스
const getFacilityTagClass = (facility: Facility) => {
  const category = getFacilityCategory(facility);

  switch (category) {
    case "public":
      return "bg-emerald-100 text-emerald-700";
    case "leisure":
      return "bg-sky-100 text-sky-700";
    case "private":
      return "bg-amber-100 text-amber-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
};

// 카카오맵 스크립트 로더
const loadKakaoMapScript = (): Promise<void> => {
  const appKey = import.meta.env.VITE_KAKAO_MAP_KEY;

  if (!appKey) {
    console.error("[KAKAO] VITE_KAKAO_MAP_KEY가 설정되지 않았습니다.");
    return Promise.reject(new Error("Kakao map key missing"));
  }

  // 이미 로드된 경우
  if ((window as any).kakao?.maps) {
    console.log("[KAKAO] 이미 kakao.maps 로드됨");
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    console.log("[KAKAO] 스크립트 로드 시작");
    const script = document.createElement("script");
    // Geocoder 사용을 위해 services 라이브러리 포함
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false&libraries=services`;
    script.async = true;
    script.onload = () => {
      console.log("[KAKAO] 스크립트 로드 완료, kakao.maps.load 호출");
      (window as any).kakao.maps.load(() => {
        console.log("[KAKAO] kakao.maps.load 완료");
        resolve();
      });
    };
    script.onerror = () => {
      console.error("[KAKAO] 스크립트 로드 실패");
      reject(new Error("Failed to load Kakao map script"));
    };
    document.head.appendChild(script);
  });
};

// InfoWindow에 들어갈 HTML 문자열
const makeInfoContent = (facility: Facility) => {
  const name = facility.name ?? "";
  const addr = facility.address ?? "";
  const phone = facility.phone ?? "";
  const tagLabel = getFacilityTagLabel(facility);

  return `
    <div style="padding:8px 10px; max-width:260px;">
      <div style="font-size:11px; color:#38bdf8; margin-bottom:2px;">
        ${tagLabel}
      </div>
      <div style="font-weight:600; margin-bottom:4px; font-size:13px;">
        ${name}
      </div>
      <div style="font-size:12px; color:#555; margin-bottom:2px;">
        ${addr}
      </div>
      ${
        phone
          ? `<div style="font-size:12px; color:#777; margin-top:2px;">☎ ${phone}</div>`
          : ""
      }
    </div>
  `;
};

// ================== 메인 컴포넌트 ==================

export const FacilityFinder = () => {
  const [selectedRegion, setSelectedRegion] = useState<Region>("부산");
  const [selectedCategory, setSelectedCategory] = useState<FacilityCategory>("all");

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any | null>(null);

  // 시설 id -> 마커 매핑, 공용 인포윈도우
  const markerMapRef = useRef<Map<number, any>>(new Map());
  const infoWindowRef = useRef<any | null>(null);

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

  // 시설 목록 가져오기 (Supabase -> Node 백엔드)
  const { data, isLoading, isError } = useQuery<FacilityListResponse>({
    queryKey: ["facilities", selectedRegion],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedRegion) params.set("sido", selectedRegion);
      params.set("page", "1");
      params.set("pageSize", "1000"); // 충분히 크게

      const res = await fetch(`${apiBaseUrl}/api/facilities?${params.toString()}`);
      if (!res.ok) {
        throw new Error("시설 목록을 불러오는데 실패했습니다.");
      }
      return res.json();
    },
  });

  const facilities = data?.items ?? [];

  // 카테고리 필터링
  const filteredFacilities = useMemo(() => {
    if (selectedCategory === "all") return facilities;

    return facilities.filter((f) => getFacilityCategory(f) === selectedCategory);
  }, [facilities, selectedCategory]);

  // 집계
  const { publicCount, leisureCount, privateCount } = useMemo(() => {
    let publicC = 0;
    let leisureC = 0;
    let privateC = 0;

    for (const f of facilities) {
      const cat = getFacilityCategory(f);
      if (cat === "public") publicC += 1;
      else if (cat === "leisure") leisureC += 1;
      else if (cat === "private") privateC += 1;
    }

    return { publicCount: publicC, leisureCount: leisureC, privateCount: privateC };
  }, [facilities]);

  // 카카오맵 초기화 & 마커 그리기
  useEffect(() => {
    if (!mapContainerRef.current || filteredFacilities.length === 0) {
      console.log("[MAP] 표시할 시설이 없습니다.");
      return;
    }

    let isCancelled = false;

    const initMap = async () => {
      try {
        console.log("[MAP] initMap start, 시설 수:", filteredFacilities.length);
        await loadKakaoMapScript();
        if (isCancelled || !mapContainerRef.current) return;

        const kakao = (window as any).kakao;
        console.log("[MAP] kakao 객체:", kakao);

        // 기본 중심 (부산 시청 근처)
        const defaultCenter = new kakao.maps.LatLng(35.1796, 129.0756);

        const map = new kakao.maps.Map(mapContainerRef.current, {
          center: defaultCenter,
          level: 7,
        });
        mapRef.current = map;

        const bounds = new kakao.maps.LatLngBounds();
        const geocoder = new kakao.maps.services.Geocoder();

        // 이전 마커 정리
        markerMapRef.current.forEach((marker) => marker.setMap(null));
        markerMapRef.current.clear();

        const infoWindow = new kakao.maps.InfoWindow({ zIndex: 1 });
        infoWindowRef.current = infoWindow;

        let hasPosition = false;

        // 시설별 마커
        for (const facility of filteredFacilities) {
          const lat = facility.lat;
          const lon = facility.lon;
          let position: any = null;

          if (lat && lon) {
            position = new kakao.maps.LatLng(lat, lon);
          } else if (facility.address) {
            // 좌표 없으면 주소로 검색
            // eslint-disable-next-line no-await-in-loop
            position = await new Promise((resolve) => {
              geocoder.addressSearch(
                facility.address as string,
                (result: any, status: string) => {
                  if (status === kakao.maps.services.Status.OK && result[0]) {
                    resolve(new kakao.maps.LatLng(result[0].y, result[0].x));
                  } else {
                    resolve(null);
                  }
                },
              );
            });
          }

          if (!position) continue;

          const marker = new kakao.maps.Marker({ position });
          marker.setMap(map);
          markerMapRef.current.set(facility.id, marker);
          bounds.extend(position);
          hasPosition = true;

          // 마커 클릭 시 InfoWindow
          kakao.maps.event.addListener(marker, "click", () => {
            const content = makeInfoContent(facility);
            infoWindow.setContent(content);
            infoWindow.open(map, marker);
          });
        }

        if (!hasPosition) {
          console.warn("[MAP] 표시할 좌표가 없습니다.");
          map.setCenter(defaultCenter);
        } else {
          map.setBounds(bounds);
        }
      } catch (e) {
        console.error("[MAP] 초기화 에러", e);
      }
    };

    initMap();

    return () => {
      isCancelled = true;

      // ✅ DOM은 건드리지 않고, 지도 객체/마커만 정리
      markerMapRef.current.forEach((marker) => marker.setMap(null));
      markerMapRef.current.clear();

      if (infoWindowRef.current) {
        infoWindowRef.current.close();
      }

      mapRef.current = null;
    };
  }, [filteredFacilities]);

  // 리스트에서 시설 클릭 시: 해당 마커로 이동 + InfoWindow 표시
  const handleSelectFacility = (facility: Facility) => {
    const kakao = (window as any).kakao;
    if (!mapRef.current || !kakao) return;

    const map = mapRef.current;
    let infoWindow = infoWindowRef.current;

    if (!infoWindow) {
      infoWindow = new kakao.maps.InfoWindow({ zIndex: 1 });
      infoWindowRef.current = infoWindow;
    }

    const marker = markerMapRef.current.get(facility.id);

    // 1) 이미 만들어 둔 마커가 있으면 그걸 사용
    if (marker) {
      const content = makeInfoContent(facility);
      infoWindow.setContent(content);
      infoWindow.open(map, marker);
      map.setCenter(marker.getPosition());
      map.setLevel(4);
      return;
    }

    // 2) 마커가 없지만 좌표는 있을 때
    if (facility.lat && facility.lon) {
      const pos = new kakao.maps.LatLng(facility.lat, facility.lon);
      map.setCenter(pos);
      map.setLevel(4);
      const tempMarker = new kakao.maps.Marker({ position: pos });
      tempMarker.setMap(map);
      infoWindow.setContent(makeInfoContent(facility));
      infoWindow.open(map, tempMarker);
      return;
    }

    // 3) 좌표도 없고 마커도 없을 때, 주소 기반 검색
    if (facility.address) {
      const geocoder = new kakao.maps.services.Geocoder();
      geocoder.addressSearch(facility.address, (result: any, status: string) => {
        if (status === kakao.maps.services.Status.OK && result[0]) {
          const pos = new kakao.maps.LatLng(result[0].y, result[0].x);
          map.setCenter(pos);
          map.setLevel(4);
          const tempMarker = new kakao.maps.Marker({ position: pos });
          tempMarker.setMap(map);
          infoWindow.setContent(makeInfoContent(facility));
          infoWindow.open(map, tempMarker);
        }
      });
    }
  };

  return (
    <section id="facilities" className="py-16 bg-gradient-to-b from-background to-accent/30">
      <div className="container mx-auto px-4">
        {/* 제목 */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-foreground mb-4">우리동네 생활체육시설 찾아보기</h2>
          <p className="text-lg text-muted-foreground">내 주변 생활체육시설 정보를 한눈에!</p>
        </div>

        {/* 지역 + 카테고리 필터 */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            <span className="text-sm text-muted-foreground">현재 위치 기준 주변 생활체육시설</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 ml-auto">
            {/* 카테고리 필터 버튼들 */}
            <div className="flex gap-1 rounded-full bg-white/80 px-1 py-1 shadow-sm">
              {[
                { id: "all", label: "전체" },
                { id: "public", label: "공공체육시설" },
                { id: "leisure", label: "레저스포츠" },
                { id: "private", label: "민간시설" },
              ].map((btn) => (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => setSelectedCategory(btn.id as FacilityCategory)}
                  className={[
                    "px-3 py-1 text-xs sm:text-sm rounded-full transition-colors",
                    selectedCategory === btn.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-transparent text-muted-foreground hover:bg-primary/10",
                  ].join(" ")}
                >
                  {btn.label}
                </button>
              ))}
            </div>

            {/* 지역 선택 */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">지역 선택</span>
              <Select value={selectedRegion} onValueChange={(value) => setSelectedRegion(value as Region)}>
                <SelectTrigger className="w-40 bg-white/80">
                  <SelectValue placeholder="시·도 선택" />
                </SelectTrigger>
                <SelectContent>
                  {regions.map((region) => (
                    <SelectItem key={region} value={region}>
                      {region}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* 지도 + 리스트 */}
        <div className="grid md:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)] gap-6 max-w-6xl mx-auto">
          {/* 카카오맵 */}
          <Card className="p-0 overflow-hidden shadow-lg border-border">
            <div ref={mapContainerRef} className="w-full h-[420px] bg-muted">
              {!isLoading && filteredFacilities.length === 0 && (
                <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                  표시할 시설이 없습니다.
                </div>
              )}
            </div>
          </Card>

          {/* 오른쪽 리스트 */}
          <div className="flex flex-col h-[420px]">
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {isLoading && <p className="text-sm text-muted-foreground">시설 정보를 불러오는 중입니다…</p>}
              {isError && (
                <p className="text-sm text-red-500">시설 정보를 불러오는데 문제가 발생했습니다.</p>
              )}

              {!isLoading &&
                !isError &&
                filteredFacilities.map((facility) => (
                  <Card
                    key={facility.id}
                    className="flex items-center gap-4 p-4 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => handleSelectFacility(facility)}
                  >
                    <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                      <Building2 className="w-7 h-7 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`px-2 py-0.5 text-[11px] rounded-full ${getFacilityTagClass(
                            facility,
                          )}`}
                        >
                          {getFacilityTagLabel(facility)}
                        </span>
                        <p className="text-sm text-muted-foreground truncate">
                          {facility.sido} {facility.sigungu}
                        </p>
                      </div>
                      <h3 className="text-sm font-semibold text-foreground truncate">{facility.name}</h3>
                      <p className="text-xs text-muted-foreground truncate">{facility.address}</p>
                    </div>
                  </Card>
                ))}
            </div>

            {/* 하단 집계 */}
            <div className="mt-3 pt-2 border-t flex flex-wrap items-center justify-between text-xs text-muted-foreground gap-2">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-emerald-500" />
                <span className="font-medium">공공체육시설 {publicCount.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2">
                <Home className="w-4 h-4 text-sky-500" />
                <span className="font-medium">레저스포츠 {leisureCount.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2">
                <Home className="w-4 h-4 text-amber-500" />
                <span className="font-medium">민간시설 {privateCount.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FacilityFinder;