import { useState, useEffect } from "react";
import { AlertTriangle, Clock, Book } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Header from "@/components/Header";
import logger from '@/utils/logger';
import { useNavigate } from "react-router-dom"; // ★ 추가

interface PendingTransaction {
  id: string;
  status: string;
  created_at: string;
  book: {
    title: string;
    author: string;
    cover_image_url: string | null;
    transaction_type: string;
  };
  owner: {
    display_name: string | null;
  };
}

const RentalRestriction = () => {
  const { user } = useAuth();
  const navigate = useNavigate(); // ★ 추가
  const [pendingTransactions, setPendingTransactions] = useState<PendingTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchPendingTransactions();
    }
  }, [user]);

  const fetchPendingTransactions = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // First, get transactions
      const { data: transactionsData, error: transactionsError } = await supabase
        .from('transactions')
        .select('*')
        .eq('borrower_id', user.id)
        .in('status', ['requested', 'in_progress'])
        .order('created_at', { ascending: false });

      if (transactionsError) {
        logger.error('Error fetching pending transactions:', transactionsError);
        return;
      }

      if (!transactionsData || transactionsData.length === 0) {
        setPendingTransactions([]);
        return;
      }

      // Get book IDs and owner IDs
      const bookIds = [...new Set(transactionsData.map(t => t.book_id))];
      const ownerIds = [...new Set(transactionsData.map(t => t.owner_id))];

      // Fetch books
      const { data: booksData } = await supabase
        .from('books')
        .select('id, title, author, cover_image_url, transaction_type')
        .in('id', bookIds);

      // Fetch owner profiles
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', ownerIds);

      // Create maps for easier lookup
      const booksMap = (booksData || []).reduce((acc, book) => {
        acc[book.id] = book;
        return acc;
      }, {} as Record<string, any>);

      const profilesMap = (profilesData || []).reduce((acc, profile) => {
        acc[profile.user_id] = profile;
        return acc;
      }, {} as Record<string, any>);

      // Combine data
      const combinedData = transactionsData.map(transaction => ({
        ...transaction,
        book: booksMap[transaction.book_id] || null,
        owner: profilesMap[transaction.owner_id] || null
      }));

      setPendingTransactions(combinedData as any);
    } catch (error) {
      logger.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDefaultCoverImage = () => {
    return "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=300&h=400&fit=crop&crop=center";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'requested':
        return <Badge variant="outline">요청됨</Badge>;
      case 'in_progress':
        return <Badge variant="secondary">진행중</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getStatusMessage = (status: string) => {
    switch (status) {
      case 'requested':
        return "책 주인의 승인을 기다리고 있습니다.";
      case 'in_progress':
        return "책을 반납하고 주인의 반납 인증을 기다리고 있습니다.";
      default:
        return "거래 진행 중입니다.";
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <p className="text-muted-foreground">로그인이 필요합니다.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Alert Header */}
          <Card className="border-destructive mb-6">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <AlertTriangle className="h-16 w-16 text-destructive" />
              </div>
              <CardTitle className="text-xl text-destructive">
                대여 제한 안내
              </CardTitle>
              <CardDescription className="text-base">
                이전 거래의 반납 인증이 완료되지 않아 새로운 책을 대여할 수 없습니다.
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Pending Transactions */}
          {loading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">거래 내역을 확인하는 중...</p>
            </div>
          ) : pendingTransactions.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <Book className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  현재 진행중인 거래가 없습니다. 자유롭게 새로운 책을 대여하실 수 있습니다.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground mb-4">
                완료되지 않은 거래 ({pendingTransactions.length}건)
              </h2>
              
              {pendingTransactions.map((transaction) => (
                <Card key={transaction.id} className="border-warning">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-20 bg-muted rounded overflow-hidden flex-shrink-0">
                        <img 
                          src={transaction.book?.cover_image_url || getDefaultCoverImage()} 
                          alt={transaction.book?.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src = getDefaultCoverImage();
                          }}
                        />
                      </div>
                      
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">{transaction.book?.title}</h3>
                        <p className="text-sm text-muted-foreground">{transaction.book?.author}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          소유자: {transaction.owner?.display_name || "익명"}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          {getStatusBadge(transaction.status)}
                          <span className="text-xs text-muted-foreground">
                            {new Date(transaction.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm text-warning mt-2">
                          {getStatusMessage(transaction.status)}
                        </p>
                      </div>
                      
                      <div className="text-right">
                        <Clock className="h-6 w-6 text-warning" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-8 space-y-4">
            <Card className="bg-accent">
              <CardContent className="p-4">
                <h3 className="font-medium mb-2">해결 방법</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• 대여 요청이 진행중인 경우: 책 주인의 승인을 기다려주세요</li>
                  <li>• 거래가 진행중인 경우: 책을 반납하고 주인의 반납 인증을 기다려주세요</li>
                  <li>• 문제가 지속되는 경우: 책 주인과 직접 연락하여 해결해주세요</li>
                </ul>
              </CardContent>
            </Card>

            <div className="flex gap-4">
              {/* 여기에서 navigate로 이동합니다. */}
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => navigate("/my")}
              >
                내 거래 내역 확인
              </Button>
              <Button 
                variant="soft" 
                className="flex-1"
                onClick={() => navigate("/books")}
              >
                책 둘러보기
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default RentalRestriction;
