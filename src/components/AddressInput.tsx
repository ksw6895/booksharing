import React, { useState, useEffect } from 'react';
import { Search, MapPin, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { useKakaoMaps } from '@/hooks/useKakaoMaps';

declare global {
  interface Window {
    kakao: any;
  }
}

interface AddressResult {
  address_name?: string;
  road_address_name?: string;
  place_name?: string;
  x: string; // longitude
  y: string; // latitude
}

interface AddressInputProps {
  value?: string;
  onChange: (address: string, coordinates?: { lat: number; lng: number }) => void;
  placeholder?: string;
  showMap?: boolean;
}

export const AddressInput: React.FC<AddressInputProps> = ({
  value = '',
  onChange,
  placeholder = '주소를 입력하세요',
  showMap = false
}) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<AddressResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCoordinates, setSelectedCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const { ready: kakaoReady, ensureLoaded } = useKakaoMaps();

  const { toast } = useToast();

  useEffect(() => {
    // Kakao Maps API 초기화
    if (window.kakao && window.kakao.maps) {
      window.kakao.maps.load(() => {
        // API loaded callback
      });
    }
  }, []);
  useEffect(() => {
    if (!isSearchOpen || userLocation) return;
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {},
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  }, [isSearchOpen, userLocation]);
  useEffect(() => {
    // 선택된 좌표가 있으면 미니 맵을 표시
    if (!showMap || !selectedCoordinates) return;
    if (!window.kakao || !window.kakao.maps) return;

    let mapInstance: any = null;
    let markerInstance: any = null;

    const renderMap = () => {
      const container = document.getElementById('kakao-map');
      if (!container) return;
      
      // Clean up existing map if any
      if (mapInstance) {
        mapInstance = null;
      }
      
      const center = new window.kakao.maps.LatLng(
        selectedCoordinates.lat,
        selectedCoordinates.lng
      );
      mapInstance = new window.kakao.maps.Map(container, {
        center,
        level: 3,
      });
      markerInstance = new window.kakao.maps.Marker({ 
        position: center, 
        map: mapInstance 
      });
    };

    if (window.kakao.maps.load) {
      window.kakao.maps.load(renderMap);
    } else {
      renderMap();
    }

    // Cleanup function to prevent memory leaks
    return () => {
      if (markerInstance) {
        markerInstance.setMap(null);
        markerInstance = null;
      }
      if (mapInstance) {
        const container = document.getElementById('kakao-map');
        if (container) {
          container.innerHTML = '';
        }
        mapInstance = null;
      }
    };
  }, [showMap, selectedCoordinates, isSearchOpen]);

  // 지역(시/도, 시/군/구) 접두사를 붙여 재검색하는 보조 함수
  const retryWithLocalPrefix = async (originalQuery: string): Promise<boolean> => {
    if (!userLocation || !window.kakao?.maps?.services) return false;
    try {
      await ensureLoaded();
    } catch {
      return false;
    }

    return new Promise<boolean>((resolve) => {
      const geocoder = new window.kakao.maps.services.Geocoder();
      // 좌표 -> 행정구역 이름 조회
      geocoder.coord2RegionCode(
        userLocation.lng,
        userLocation.lat,
        (regions: any[], status: any) => {
          if (status !== window.kakao.maps.services.Status.OK || !regions?.length) {
            resolve(false);
            return;
          }
          const r = regions.find((x: any) => x.region_type === 'H') || regions[0];
          const prefix = [r.region_1depth_name, r.region_2depth_name].filter(Boolean).join(' ');
          const prefixedQuery = `${prefix} ${originalQuery}`;

          // 1) 주소 지오코딩 시도
          geocoder.addressSearch(prefixedQuery, (addrResults: AddressResult[], addrStatus: any) => {
            if (addrStatus === window.kakao.maps.services.Status.OK && addrResults.length > 0) {
              setSearchResults(addrResults.slice(0, 10));
              resolve(true);
            } else {
              // 2) 키워드 검색 재시도 (지역 편향 포함)
              const places = new window.kakao.maps.services.Places();
              const opts: any = {};
              try {
                opts.location = new window.kakao.maps.LatLng(userLocation.lat, userLocation.lng);
                opts.radius = 20000;
              } catch {}
              places.keywordSearch(
                prefixedQuery,
                (placeResults: any[], placeStatus: any) => {
                  if (placeStatus === window.kakao.maps.services.Status.OK && placeResults.length > 0) {
                    const mapped = placeResults.slice(0, 10).map((p: any) => ({
                      address_name: p.address_name,
                      road_address_name: p.road_address_name,
                      place_name: p.place_name,
                      x: p.x,
                      y: p.y,
                    }));
                    setSearchResults(mapped);
                    resolve(true);
                  } else {
                    resolve(false);
                  }
                },
                opts
              );
            }
          });
        }
      );
    });
  };

  // 지역 접두사 목록 기반 보정 검색 (위치 권한이 없을 때 대비)
  const REGION_PREFIXES = [
    '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
    '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남',
    '제주', '제주특별자치도'
  ];

  const fallbackWithRegionPrefixes = async (originalQuery: string): Promise<boolean> => {
    if (!window.kakao?.maps?.services) return false;
    try {
      await ensureLoaded();
    } catch {
      return false;
    }

    const places = new window.kakao.maps.services.Places();
    // 도로명/지명으로 보이는 짧은 쿼리일 때만 시/도 접두사 보정
    const isLikelyRoadOrPlace = /^[가-힣A-Za-z0-9\s]+$/.test(originalQuery) && originalQuery.length <= 10;
    const targetPrefixes = isLikelyRoadOrPlace ? REGION_PREFIXES : REGION_PREFIXES.slice(0, 8);

    for (const prefix of targetPrefixes) {
      const ok = await new Promise<boolean>((resolve) => {
        const q = `${prefix} ${originalQuery}`.trim();
        places.keywordSearch(
          q,
          (results: any[], status: any) => {
            if (status === window.kakao.maps.services.Status.OK && results.length > 0) {
              const mapped = results.slice(0, 10).map((p: any) => ({
                address_name: p.address_name,
                road_address_name: p.road_address_name,
                place_name: p.place_name,
                x: p.x,
                y: p.y,
              }));
              setSearchResults(mapped);
              resolve(true);
            } else {
              resolve(false);
            }
          }
        );
      });
      if (ok) return true;
    }

    return false;
  };

  const searchAddresses = async (query: string) => {
    if (!query.trim()) return;

    try {
      await ensureLoaded();
    } catch (e) {
      toast({ title: '카카오 지도 로딩 실패', description: '잠시 후 다시 시도해주세요.' });
      return;
    }

    if (!window.kakao || !window.kakao.maps || !window.kakao.maps.services) {
      toast({ title: '카카오 지도 준비 중', description: '잠시 후 다시 시도해주세요.' });
      return;
    }

    setLoading(true);
    try {
      const geocoder = new window.kakao.maps.services.Geocoder();

      geocoder.addressSearch(query, (results: AddressResult[], status: any) => {
        if (status === window.kakao.maps.services.Status.OK && results.length > 0) {
          setSearchResults(results.slice(0, 10)); // 최대 10개 결과
          setLoading(false);
        } else {
          const places = new window.kakao.maps.services.Places();
          const opts: any = {};
          try {
            if (userLocation && window.kakao?.maps) {
              opts.location = new window.kakao.maps.LatLng(userLocation.lat, userLocation.lng);
              opts.radius = 20000; // 20km 반경 내 우선 검색
            }
          } catch {}
           places.keywordSearch(query, (placeResults: any[], placeStatus: any) => {
             if (placeStatus === window.kakao.maps.services.Status.OK && placeResults.length > 0) {
               const mapped = placeResults.slice(0, 10).map((p: any) => ({
                 address_name: p.address_name,
                 road_address_name: p.road_address_name,
                 place_name: p.place_name,
                 x: p.x,
                 y: p.y,
               }));
               setSearchResults(mapped);
               setLoading(false);
             } else {
               (async () => {
                 const retried = await retryWithLocalPrefix(query);
                 if (!retried) {
                   const prefixed = await fallbackWithRegionPrefixes(query);
                   if (!prefixed) {
                     setSearchResults([]);
                     // show toast only when it's an error, not just no results
                     if (placeStatus !== window.kakao.maps.services.Status.ZERO_RESULT) {
                       toast({ title: '검색 실패', description: '검색 결과가 없거나 오류가 발생했습니다.' });
                     }
                   }
                 }
                 setLoading(false);
               })();
             }
           }, opts);
        }
      });
    } catch (error) {
      toast({ title: '오류', description: '주소 검색 중 오류가 발생했습니다.' });
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    try {
      await ensureLoaded();
    } catch {}

    if (window.kakao?.maps?.services) {
      setLoading(true);
      const places = new window.kakao.maps.services.Places();
      const opts: any = {};
      try {
        if (userLocation && window.kakao?.maps) {
          opts.location = new window.kakao.maps.LatLng(userLocation.lat, userLocation.lng);
          opts.radius = 20000; // 20km
        }
      } catch {}
      places.keywordSearch(searchQuery, (placeResults: any[], placeStatus: any) => {
        if (placeStatus === window.kakao.maps.services.Status.OK && placeResults.length > 0) {
          const mapped = placeResults.slice(0, 10).map((p: any) => ({
            address_name: p.address_name,
            road_address_name: p.road_address_name,
            place_name: p.place_name,
            x: p.x,
            y: p.y,
          }));
          setSearchResults(mapped);
          setLoading(false);
        } else {
          // fallback to address geocoding for full road-name queries
          searchAddresses(searchQuery);
        }
      }, opts);
    } else {
      searchAddresses(searchQuery);
    }
  };

  const handleSelectAddress = (result: AddressResult) => {
  const address = result.road_address_name || result.address_name || result.place_name || '';
  const coordinates = {
    lat: parseFloat(result.y),
    lng: parseFloat(result.x)
  };
    
    onChange(address, coordinates);
    setSelectedCoordinates(coordinates);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  return (
    <>
      <div className="relative">
        <Input
          value={value}
          placeholder={placeholder}
          readOnly
          onClick={() => setIsSearchOpen(true)}
          className="cursor-pointer pr-10"
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
          onClick={() => setIsSearchOpen(true)}
        >
          <Search className="h-4 w-4" />
        </Button>
      </div>

      {/* 주소 검색 모달 */}
      <Dialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              주소 검색
            </DialogTitle>
            <DialogDescription>
              도로명/지번 또는 장소명을 입력하고 검색을 눌러주세요.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* 검색 입력 */}
            <div className="flex gap-2">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="도로명 주소나 지번 주소를 입력하세요"
                onKeyDown={handleKeyPress}
                className="flex-1"
              />
              <Button 
                onClick={handleSearch} 
                disabled={!searchQuery.trim() || loading}
                size="sm"
              >
                {loading ? '검색 중...' : '검색'}
              </Button>
            </div>

            {/* 검색 결과 */}
            <div className="max-h-80 overflow-y-auto space-y-2">
              {searchResults.length > 0 ? (
                searchResults.map((result, index) => (
                  <Card 
                    key={index} 
                    className="cursor-pointer hover:bg-accent transition-colors"
                    onClick={() => handleSelectAddress(result)}
                  >
                    <CardContent className="p-3">
                      <div className="space-y-1">
                        {(result.road_address_name || result.place_name) && (
                          <p className="font-medium text-sm">{result.road_address_name || result.place_name}</p>
                        )}
                        {result.address_name && (
                          <p className="text-xs text-muted-foreground">{result.address_name}</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : searchQuery && !loading ? (
                <p className="text-center text-muted-foreground py-8">
                  검색 결과가 없습니다.
                </p>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  주소를 검색해주세요.
                </p>
              )}
            </div>

            {/* 지도 표시 (옵션) */}
            {showMap && selectedCoordinates && (
              <div className="mt-4">
                <div id="kakao-map" className="w-full h-48 rounded-lg border"></div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};