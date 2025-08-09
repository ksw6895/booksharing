import { useState, useEffect } from "react";
import { Gift, CheckCircle, Star, Book, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import logger from '@/utils/logger';

interface EligibleBook {
  id: string;
  title: string;
  author: string;
  cover_image_url: string | null;
  price: number;
  total_earnings: number;
  completed_transactions: number;
}

const RewardNotification = () => {
  const { user } = useAuth();
  const [eligibleBooks, setEligibleBooks] = useState<EligibleBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimingReward, setClaimingReward] = useState(false);

  useEffect(() => {
    if (user) {
      fetchEligibleBooks();
    }
  }, [user]);

  const fetchEligibleBooks = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Get books owned by user with completed rental transactions
      const { data: booksData, error: booksError } = await supabase
        .from('books')
        .select(`
          id,
          title,
          author,
          cover_image_url,
          price,
          transaction_type
        `)
        .eq('user_id', user.id)
        .eq('transaction_type', 'rental'); // Only rental books are eligible for rewards

      if (booksError) {
        logger.error('Error fetching books:', booksError);
        return;
      }

      const books = booksData || [];
      const eligibleBooksData: EligibleBook[] = [];

      // For each book, calculate total earnings from completed transactions
      for (const book of books) {
        const { data: transactionsData, error: transactionsError } = await supabase
          .from('transactions')
          .select('*')
          .eq('book_id', book.id)
          .eq('status', 'completed');

        if (transactionsError) {
          logger.error('Error fetching transactions:', transactionsError);
          continue;
        }

        const transactions = transactionsData || [];
        const totalEarnings = transactions.length * book.price; // Each completed transaction earns the daily rate
        const completedTransactions = transactions.length;

        // Check if total earnings exceed book price (eligible for reward)
        if (totalEarnings > book.price && completedTransactions > 0) {
          eligibleBooksData.push({
            id: book.id,
            title: book.title,
            author: book.author,
            cover_image_url: book.cover_image_url,
            price: book.price,
            total_earnings: totalEarnings,
            completed_transactions: completedTransactions,
          });
        }
      }

      setEligibleBooks(eligibleBooksData);
    } catch (error) {
      logger.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClaimReward = async () => {
    if (!user) return;

    setClaimingReward(true);

    try {
      // Here you would typically:
      // 1. Send notification to admin
      // 2. Log the reward claim
      // 3. Update user's reward status
      
      // For now, we'll just show a success message
      toast({
        title: "보상 신청 완료",
        description: "관리자가 확인 후 새 책을 보내드립니다. 등록하신 주소로 배송될 예정입니다.",
      });

      // Note: In a real implementation, you would:
      // 1. Create a reward_claims table in the database
      // 2. Send email notification to admin
      // 3. Log the reward claim for tracking

    } catch (error) {
      toast({
        title: "오류가 발생했습니다",
        description: "다시 시도해 주세요.",
        variant: "destructive",
      });
    } finally {
      setClaimingReward(false);
    }
  };

  const getDefaultCoverImage = () => {
    return "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=300&h=400&fit=crop&crop=center";
  };

  const calculateProfitRatio = (earnings: number, price: number) => {
    return Math.round((earnings / price) * 100);
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
          {/* Congratulations Header */}
          <Card className="border-primary mb-6">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <Gift className="h-16 w-16 text-primary" />
              </div>
              <CardTitle className="text-2xl text-primary">
                🎉 축하합니다!
              </CardTitle>
              <CardDescription className="text-base">
                책 대여로 원래 가격보다 더 많은 수익을 얻으셨습니다!
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Loading State */}
          {loading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">보상 대상 확인 중...</p>
            </div>
          ) : eligibleBooks.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <Book className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-2">
                  아직 보상 대상 책이 없습니다.
                </p>
                <p className="text-sm text-muted-foreground">
                  책을 대여해서 원래 가격보다 더 많은 수익을 얻으면 새 책을 보상으로 받을 수 있습니다!
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Reward Message */}
              <Card className="bg-gradient-to-r from-primary/10 to-primary/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Star className="h-5 w-5 text-primary" />
                    새 책을 보상으로 보내드립니다!
                  </CardTitle>
                  <CardDescription>
                    아래 책들의 대여 수익이 원래 가격을 초과했습니다. 
                    새로운 책을 보상으로 받을 자격이 있습니다.
                  </CardDescription>
                </CardHeader>
              </Card>

              {/* Eligible Books List */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">보상 대상 책 ({eligibleBooks.length}권)</h2>
                
                {eligibleBooks.map((book) => (
                  <Card key={book.id} className="border-primary/20">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-20 bg-muted rounded overflow-hidden flex-shrink-0">
                          <img 
                            src={book.cover_image_url || getDefaultCoverImage()} 
                            alt={book.title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.src = getDefaultCoverImage();
                            }}
                          />
                        </div>
                        
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg">{book.title}</h3>
                          <p className="text-sm text-muted-foreground">{book.author}</p>
                          
                          <div className="mt-2 space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span>원래 가격:</span>
                              <span>{book.price.toLocaleString()}원</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span>총 수익:</span>
                              <span className="font-semibold text-primary">
                                {book.total_earnings.toLocaleString()}원
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span>완료된 대여:</span>
                              <span>{book.completed_transactions}회</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <Badge variant="default" className="bg-primary">
                            {calculateProfitRatio(book.total_earnings, book.price)}% 수익
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Separator />

              {/* Reward Claim Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5" />
                    보상 신청
                  </CardTitle>
                  <CardDescription>
                    새 책 수령을 원하시면 아래 버튼을 클릭해주세요. 
                    관리자가 확인 후 연락드립니다.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-accent rounded-lg">
                    <h4 className="font-medium mb-2">보상 안내</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• 보상용 새 책은 관리자가 선별하여 보내드립니다</li>
                      <li>• 등록된 주소로 배송됩니다 (배송비 무료)</li>
                      <li>• 신청 후 3-5일 내에 배송 예정입니다</li>
                      <li>• 문의사항은 고객센터로 연락해주세요</li>
                    </ul>
                  </div>

                  <Button 
                    onClick={handleClaimReward}
                    className="w-full" 
                    disabled={claimingReward}
                    variant="warm"
                    size="lg"
                  >
                    {claimingReward ? "신청 처리 중..." : (
                      <>
                        <Gift className="h-4 w-4 mr-2" />
                        새 책 보상 신청하기
                      </>
                    )}
                  </Button>

                  <div className="text-center">
                    <Button variant="outline" size="sm" className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      관리자에게 문의하기
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default RewardNotification;