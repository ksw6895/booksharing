import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Book, Plus, Edit, Trash2, Eye, Clock, CheckCircle, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import logger from '@/utils/logger';

interface MyBook {
  id: string;
  title: string;
  author: string;
  isbn: string | null;
  cover_image_url: string | null;
  transaction_type: string;
  price: number;
  status: string;
  created_at: string;
}

interface Transaction {
  id: string;
  status: string;
  created_at: string;
  borrower_id: string;
  owner_id: string;
  book: {
    id: string;
    title: string;
    author: string;
    cover_image_url: string | null;
  } | null;
  borrower: {
    display_name: string | null;
  } | null;
  owner: {
    display_name: string | null;
  } | null;
}

const MyPage = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [myBooks, setMyBooks] = useState<MyBook[]>([]);
  const [myTransactions, setMyTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return; // Wait for auth to complete
    
    if (!user) {
      navigate("/auth");
      return;
    }
    fetchMyData();
  }, [user, authLoading, navigate]);

  const fetchMyData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Fetch my books
      const { data: booksData, error: booksError } = await supabase
        .from('books')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (booksError) {
        logger.error('Error fetching books:', booksError);
      } else {
        setMyBooks(booksData || []);
      }

      // Fetch my transactions (both as borrower and owner)
      const { data: transactionsData, error: transactionsError } = await supabase
        .from('transactions')
        .select(`
          *,
          book:book_id (
            id,
            title,
            author,
            cover_image_url
          ),
          borrower:borrower_id (
            display_name
          ),
          owner:owner_id (
            display_name
          )
        `)
        .or(`borrower_id.eq.${user.id},owner_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (transactionsError) {
        logger.error('Error fetching transactions:', transactionsError);
      } else {
        setMyTransactions((transactionsData || []) as any);
      }
    } catch (error) {
      logger.error('Error:', error);
      toast({
        title: "데이터 로딩 실패",
        description: "데이터를 불러올 수 없습니다.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBook = async (bookId: string) => {
    if (!confirm("정말로 이 책을 삭제하시겠습니까?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from('books')
        .delete()
        .eq('id', bookId);

      if (error) {
        toast({
          title: "삭제 실패",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "삭제 완료",
          description: "책이 성공적으로 삭제되었습니다.",
        });
        fetchMyData();
      }
    } catch (error) {
      toast({
        title: "오류가 발생했습니다",
        description: "다시 시도해 주세요.",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'available':
        return <Badge variant="secondary">대여 가능</Badge>;
      case 'rented':
        return <Badge variant="outline">대여중</Badge>;
      case 'sold':
        return <Badge variant="destructive">판매완료</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getTransactionStatusBadge = (status: string) => {
    switch (status) {
      case 'requested':
        return <Badge variant="outline">요청됨</Badge>;
      case 'in_progress':
        return <Badge variant="secondary">진행중</Badge>;
      case 'completed':
        return <Badge variant="default">완료</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">취소됨</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getDefaultCoverImage = () => {
    return "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=300&h=400&fit=crop&crop=center";
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-4">
            내 책장
          </h1>
          <p className="text-muted-foreground">
            등록한 책과 거래 내역을 관리하세요
          </p>
        </div>

        <Tabs defaultValue="my-books" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="my-books">내 책 목록</TabsTrigger>
            <TabsTrigger value="transactions">거래 내역</TabsTrigger>
          </TabsList>

          <TabsContent value="my-books" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">등록한 책 ({myBooks.length}권)</h2>
              <div className="flex gap-2">
                <Button onClick={() => navigate("/rewards")} variant="soft">
                  <Gift className="h-4 w-4" />
                  보상 확인
                </Button>
                <Button onClick={() => navigate("/add-book")} variant="warm">
                  <Plus className="h-4 w-4" />
                  새 책 등록
                </Button>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">책 목록을 불러오는 중...</p>
              </div>
            ) : myBooks.length === 0 ? (
              <div className="text-center py-12">
                <Book className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">
                  아직 등록한 책이 없습니다.
                </p>
                <Button onClick={() => navigate("/add-book")} variant="warm">
                  첫 번째 책 등록하기
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {myBooks.map((book) => (
                  <Card key={book.id} className="overflow-hidden">
                    <CardHeader className="p-0">
                      <div className="aspect-[3/4] bg-muted relative">
                        <img 
                          src={book.cover_image_url || getDefaultCoverImage()} 
                          alt={book.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src = getDefaultCoverImage();
                          }}
                        />
                        <div className="absolute top-2 right-2">
                          {getStatusBadge(book.status)}
                        </div>
                        <div className="absolute top-2 left-2">
                          <Badge variant={book.transaction_type === "sale" ? "destructive" : "secondary"}>
                            {book.transaction_type === "sale" ? "판매" : "대여"}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="p-4">
                      <CardTitle className="text-lg mb-2 line-clamp-1">
                        {book.title}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mb-2">{book.author}</p>
                      {book.isbn && (
                        <p className="text-xs text-muted-foreground mb-3">ISBN: {book.isbn}</p>
                      )}
                      
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-primary">
                          {book.price.toLocaleString()}원{book.transaction_type === "rental" ? "/일" : ""}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(book.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </CardContent>
                    
                    <CardFooter className="p-4 pt-0 flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1">
                        <Eye className="h-4 w-4" />
                        보기
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1">
                        <Edit className="h-4 w-4" />
                        수정
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleDeleteBook(book.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="transactions" className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-4">거래 내역 ({myTransactions.length}건)</h2>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">거래 내역을 불러오는 중...</p>
              </div>
            ) : myTransactions.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  아직 거래 내역이 없습니다.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {myTransactions.map((transaction) => (
                  <Card key={transaction.id}>
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
                          <div className="flex items-center gap-4 mt-2">
                            {getTransactionStatusBadge(transaction.status)}
                            <span className="text-sm text-muted-foreground">
                              {new Date(transaction.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        
                        <div className="text-right space-y-2">
                          <p className="text-sm text-muted-foreground">
                            {transaction.borrower?.display_name && user.id !== transaction.borrower_id
                              ? `대여자: ${transaction.borrower.display_name}`
                              : transaction.owner?.display_name && user.id !== transaction.owner_id
                              ? `소유자: ${transaction.owner.display_name}`
                              : ""}
                          </p>
                          {/* Return Proof Button - Only show for owners of in_progress transactions */}
                          {transaction.status === 'in_progress' && transaction.owner_id === user.id && (
                            <Button
                              size="sm"
                              variant="warm"
                              onClick={() => navigate(`/return-proof/${transaction.id}`)}
                              className="flex items-center gap-2"
                            >
                              <CheckCircle className="h-4 w-4" />
                              반납 인증
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default MyPage;