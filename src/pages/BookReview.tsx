import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Star, ArrowLeft, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import logger from '@/utils/logger';

interface Book {
  id: string;
  title: string;
  author: string;
  cover_image_url?: string;
}

interface Review {
  id: string;
  user_id: string;
  content: string;
  rating: number;
  created_at: string;
}

const BookReview = () => {
  const { bookId } = useParams<{ bookId: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [book, setBook] = useState<Book | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [userReview, setUserReview] = useState<Review | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState("");
  const [rating, setRating] = useState(5);
  const [canReview, setCanReview] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  logger.debug('BookReview render:', { bookId, user: !!user, authLoading, loading });

  useEffect(() => {
    if (authLoading) return; // Wait for auth to be determined
    
    if (!bookId) {
      logger.error('No bookId provided');
      setError("잘못된 책 ID입니다.");
      setLoading(false);
      return;
    }
    
    // Set up async data loading
    const loadData = async () => {
      logger.info('Loading data for bookId:', bookId);
      setLoading(true);
      setError(null);
      
      try {
        await fetchBookData();
        await fetchReviews();
        
        if (user) {
          await checkReviewPermission();
        } else {
          setCanReview(false);
        }
      } catch (err) {
        logger.error('Error loading book review data:', err);
        setError("데이터를 불러오는 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [bookId, user, authLoading]);

  const fetchBookData = async () => {
    if (!bookId) return;
    
    const { data, error } = await supabase
      .from("books")
      .select("id, title, author, cover_image_url")
      .eq("id", bookId)
      .single();

    if (error) {
      toast({
        title: "오류",
        description: "책 정보를 불러올 수 없습니다.",
        variant: "destructive",
      });
      return;
    }

    setBook(data);
  };

  const fetchReviews = async () => {
    if (!bookId) return;
    
    const { data, error } = await supabase
      .from("reviews")
      .select("*")
      .eq("book_id", bookId)
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "오류",
        description: "리뷰를 불러올 수 없습니다.",
        variant: "destructive",
      });
      return;
    }

    const currentUserReview = data?.find(review => review.user_id === user?.id);
    const otherReviews = data?.filter(review => review.user_id !== user?.id) || [];
    
    setUserReview(currentUserReview || null);
    setReviews(otherReviews);
    
    if (currentUserReview) {
      setContent(currentUserReview.content);
      setRating(currentUserReview.rating);
    }
  };

  const checkReviewPermission = async () => {
    if (!user || !bookId) return;
    
    const { data, error } = await supabase.rpc("can_user_review_book", {
      book_id_param: bookId,
      user_id_param: user.id,
    });

    if (error) {
      logger.error('Error checking review permission:', error);
      setCanReview(false);
    } else {
      setCanReview(data);
    }
    
    setLoading(false);
  };

  const handleSubmitReview = async () => {
    if (!user || !bookId || !content.trim()) return;

    if (userReview) {
      // Update existing review
      const { error } = await supabase
        .from("reviews")
        .update({
          content: content.trim(),
          rating,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userReview.id);

      if (error) {
        toast({
          title: "오류",
          description: "독후감 수정에 실패했습니다.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "성공",
        description: "독후감이 수정되었습니다.",
      });
    } else {
      // Create new review
      const { error } = await supabase
        .from("reviews")
        .insert({
          book_id: bookId,
          user_id: user.id,
          content: content.trim(),
          rating,
        });

      if (error) {
        toast({
          title: "오류",
          description: "독후감 작성에 실패했습니다.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "성공",
        description: "독후감이 작성되었습니다.",
      });
    }

    setIsEditing(false);
    fetchReviews();
  };

  const handleDeleteReview = async () => {
    if (!userReview) return;

    const { error } = await supabase
      .from("reviews")
      .delete()
      .eq("id", userReview.id);

    if (error) {
      toast({
        title: "오류",
        description: "독후감 삭제에 실패했습니다.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "성공",
      description: "독후감이 삭제되었습니다.",
    });

    setUserReview(null);
    setContent("");
    setRating(5);
    fetchReviews();
  };

  const renderStars = (rating: number, editable = false) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-5 w-5 transition-all duration-200 ${
              star <= rating
                ? "fill-warm-orange text-warm-orange"
                : "text-muted-foreground hover:text-warm-orange/50"
            } ${editable ? "cursor-pointer hover:scale-110 transform" : ""}`}
            onClick={() => editable && setRating(star)}
          />
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-warm-orange/5 via-background to-soft-green/5">
        <Header />
        <div className="container py-8">
          <div className="text-center py-12">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-muted rounded w-1/3 mx-auto"></div>
              <div className="h-4 bg-muted rounded w-1/2 mx-auto"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-warm-orange/5 via-background to-soft-green/5">
        <Header />
        <div className="container py-8">
          <div className="text-center py-12">
            <p className="text-muted-foreground text-lg">{error}</p>
            <Button 
              onClick={() => navigate("/books")} 
              className="mt-4 bg-gradient-to-r from-warm-orange to-primary hover:shadow-warm"
            >
              책 목록으로 돌아가기
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-warm-orange/5 via-background to-soft-green/5">
        <Header />
        <div className="container py-8">
          <div className="text-center py-12">
            <p className="text-muted-foreground text-lg">책을 찾을 수 없습니다.</p>
            <Button 
              onClick={() => navigate("/books")} 
              className="mt-4 bg-gradient-to-r from-warm-orange to-primary hover:shadow-warm"
            >
              책 목록으로 돌아가기
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-warm-orange/5 via-background to-soft-green/5">
      <Header />
      <div className="container py-8 max-w-4xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate(`/books/${bookId}`)}
          className="mb-6 hover:bg-warm-orange/10 transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          책 상세로 돌아가기
        </Button>

        {/* Book Info Header */}
        <Card className="mb-8 border-0 shadow-soft hover:shadow-warm transition-all duration-300 bg-gradient-to-r from-background/50 to-accent/20 backdrop-blur-sm">
          <CardContent className="p-8">
            <div className="flex gap-6 items-start">
              {book.cover_image_url && (
                <div className="relative group">
                  <img
                    src={book.cover_image_url}
                    alt={book.title}
                    className="w-24 h-32 object-cover rounded-lg shadow-md group-hover:shadow-warm transition-shadow"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"></div>
                </div>
              )}
              <div className="flex-1">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-warm-orange bg-clip-text text-transparent mb-2">
                  {book.title}
                </h1>
                <p className="text-xl text-muted-foreground mb-4">{book.author}</p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>독후감으로 이웃들과 생각을 나누어보세요</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Write/Edit Review */}
        {canReview && (
          <Card className="mb-8 border-0 shadow-soft hover:shadow-warm transition-all duration-300 bg-card">
            <CardHeader className="bg-gradient-to-r from-primary/5 to-warm-orange/5 rounded-t-lg">
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Edit className="h-5 w-5 text-primary" />
                {userReview ? "내 독후감" : "독후감 작성"}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {!isEditing && userReview ? (
                <div className="space-y-6">
                  <div className="bg-gradient-to-r from-warm-orange/10 to-primary/10 rounded-lg p-4">
                    <Label className="text-sm font-medium text-muted-foreground">평점</Label>
                    <div className="mt-2">
                      {renderStars(userReview.rating)}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">독후감</Label>
                    <div className="mt-3 p-4 bg-accent/30 rounded-lg border-l-4 border-warm-orange">
                      <p className="text-foreground whitespace-pre-wrap leading-relaxed">
                        {userReview.content}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setIsEditing(true)}
                      className="border-primary text-primary hover:bg-primary hover:text-white transition-all"
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      수정
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleDeleteReview}
                      className="hover:shadow-lg transition-all"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      삭제
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-gradient-to-r from-warm-orange/10 to-primary/10 rounded-lg p-4">
                    <Label className="text-sm font-medium text-muted-foreground">평점</Label>
                    <div className="mt-3">
                      {renderStars(rating, true)}
                      <p className="text-xs text-muted-foreground mt-2">별을 클릭하여 평점을 선택하세요</p>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="content" className="text-sm font-medium text-muted-foreground">독후감</Label>
                    <Textarea
                      id="content"
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="이 책을 읽고 느낀 점을 자유롭게 적어보세요...&#10;&#10;• 책의 어떤 부분이 가장 인상깊었나요?&#10;• 책을 통해 어떤 것을 배웠나요?&#10;• 다른 독자들에게 추천하고 싶은 이유는 무엇인가요?"
                      className="mt-3 min-h-[200px] border-muted focus:border-primary resize-none"
                    />
                    <div className="flex justify-between items-center mt-2">
                      <p className="text-xs text-muted-foreground">
                        최소 10자 이상 작성해주세요
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {content.length}자
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Button
                      onClick={handleSubmitReview}
                      disabled={!content.trim() || content.trim().length < 10}
                      className="bg-gradient-to-r from-warm-orange to-primary hover:shadow-warm transform hover:scale-105 transition-all"
                    >
                      {userReview ? "수정하기" : "작성하기"}
                    </Button>
                    {isEditing && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setIsEditing(false);
                          if (userReview) {
                            setContent(userReview.content);
                            setRating(userReview.rating);
                          }
                        }}
                        className="border-muted text-muted-foreground hover:bg-muted"
                      >
                        취소
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {!canReview && (
          <Card className="mb-8 border-0 shadow-soft bg-gradient-to-r from-muted/50 to-accent/30">
            <CardContent className="p-8 text-center">
              <div className="space-y-4">
                <div className="w-16 h-16 bg-gradient-to-r from-warm-orange/20 to-primary/20 rounded-full flex items-center justify-center mx-auto">
                  <Edit className="h-8 w-8 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">독후감 작성 권한이 없습니다</h3>
                  <p className="text-muted-foreground">
                    이 책의 독후감을 작성하려면 책을 소유하고 있거나,<br />
                    구매했거나, 대여한 기록이 있어야 합니다.
                  </p>
                </div>
                <Button
                  onClick={() => navigate(`/books/${bookId}`)}
                  variant="outline"
                  className="border-primary text-primary hover:bg-primary hover:text-white"
                >
                  책 상세 보기
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Other Reviews */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="h-8 w-1 bg-gradient-to-b from-warm-orange to-primary rounded-full"></div>
            <h2 className="text-2xl font-bold text-foreground">다른 독자들의 독후감</h2>
            <div className="flex-1 h-px bg-gradient-to-r from-border to-transparent"></div>
          </div>
          
          {reviews.length === 0 ? (
            <Card className="border-0 shadow-soft bg-gradient-to-r from-muted/30 to-accent/20">
              <CardContent className="p-12 text-center">
                <div className="space-y-4">
                  <div className="w-20 h-20 bg-gradient-to-r from-warm-orange/20 to-primary/20 rounded-full flex items-center justify-center mx-auto">
                    <Star className="h-10 w-10 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">첫 번째 독후감을 기다리고 있어요</h3>
                    <p className="text-muted-foreground">
                      아직 작성된 독후감이 없습니다.<br />
                      이 책을 읽은 분들의 생각이 궁금해요!
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6">
              {reviews.map((review, index) => (
                <Card 
                  key={review.id} 
                  className="border-0 shadow-soft hover:shadow-warm transition-all duration-300 hover:-translate-y-1 bg-card group"
                >
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-r from-warm-orange to-primary rounded-full flex items-center justify-center text-white font-semibold">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">
                            익명의 독서가
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(review.created_at).toLocaleDateString('ko-KR', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {renderStars(review.rating)}
                        <span className="text-xs text-muted-foreground">
                          {review.rating === 5 ? "최고예요!" : review.rating === 4 ? "좋아요!" : review.rating === 3 ? "보통이에요" : review.rating === 2 ? "아쉬워요" : "별로예요"}
                        </span>
                      </div>
                    </div>
                    <div className="border-l-4 border-warm-orange/30 pl-4 bg-accent/20 rounded-r-lg p-4">
                      <p className="text-foreground whitespace-pre-wrap leading-relaxed">
                        {review.content}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BookReview;
