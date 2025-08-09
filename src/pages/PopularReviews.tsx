import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Star, User, BookOpen, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Header from "@/components/Header";
import logger from '@/utils/logger';

interface ReviewWithBook {
  id: string;
  content: string;
  rating: number;
  created_at: string;
  user_id: string;
  book_id: string;
  book: {
    title: string;
    author: string;
    cover_image_url?: string;
  };
  profiles: {
    display_name?: string;
  };
}

const PopularReviews = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [reviews, setReviews] = useState<ReviewWithBook[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPopularReviews();
  }, []);

  const fetchPopularReviews = async () => {
    try {
      setLoading(true);

      // First get reviews with ratings 4 and above, ordered by rating and creation date
      const { data: reviewsData, error: reviewsError } = await supabase
        .from('reviews')
        .select('*')
        .gte('rating', 4)
        .order('rating', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(20);

      if (reviewsError) {
        logger.error('Error fetching reviews:', reviewsError);
        return;
      }

      if (!reviewsData || reviewsData.length === 0) {
        setReviews([]);
        return;
      }

      // Get unique book IDs and user IDs
      const bookIds = [...new Set(reviewsData.map(r => r.book_id))];
      const userIds = [...new Set(reviewsData.map(r => r.user_id))];

      // Fetch book data
      const { data: booksData } = await supabase
        .from('books')
        .select('id, title, author, cover_image_url')
        .in('id', bookIds);

      // Fetch user profiles
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', userIds);

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
      const combinedData = reviewsData.map(review => ({
        ...review,
        book: booksMap[review.book_id] || null,
        profiles: profilesMap[review.user_id] || null
      }));

      setReviews(combinedData.filter(r => r.book) as ReviewWithBook[]);
    } catch (error) {
      logger.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${
              star <= rating
                ? "fill-warm-orange text-warm-orange"
                : "text-muted-foreground"
            }`}
          />
        ))}
      </div>
    );
  };

  const getDefaultCoverImage = () => {
    return "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=300&h=400&fit=crop&crop=center";
  };

  const truncateContent = (content: string, maxLength: number = 200) => {
    if (content.length <= maxLength) return content;
    return content.slice(0, maxLength) + "...";
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-warm-orange/5 via-background to-soft-green/5">
      <Header />
      
      <main className="container py-8 max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="hover:bg-warm-orange/10 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            홈으로 돌아가기
          </Button>
        </div>

        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-warm-orange bg-clip-text text-transparent mb-4">
            인기 독후감
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            이웃들이 공유한 훌륭한 독후감들을 읽어보세요. 새로운 책 발견의 기회가 될 수 있습니다.
          </p>
        </div>

        {reviews.length === 0 ? (
          <Card className="border-0 shadow-soft bg-gradient-to-r from-muted/30 to-accent/20">
            <CardContent className="p-12 text-center">
              <div className="space-y-4">
                <div className="w-20 h-20 bg-gradient-to-r from-warm-orange/20 to-primary/20 rounded-full flex items-center justify-center mx-auto">
                  <Star className="h-10 w-10 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    아직 독후감이 없습니다
                  </h3>
                  <p className="text-muted-foreground">
                    첫 번째 독후감을 작성해보세요!
                  </p>
                </div>
                <Button
                  onClick={() => navigate("/books")}
                  className="bg-gradient-to-r from-warm-orange to-primary hover:shadow-warm"
                >
                  책 둘러보기
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {reviews.map((review) => (
              <Card 
                key={review.id} 
                className="border-0 shadow-soft hover:shadow-warm transition-all duration-300 cursor-pointer group"
                onClick={() => navigate(`/books/${review.book_id}/review`)}
              >
                <CardHeader className="pb-4">
                  <div className="flex gap-4">
                    <div className="relative group-hover:scale-105 transition-transform">
                      <img
                        src={review.book.cover_image_url || getDefaultCoverImage()}
                        alt={review.book.title}
                        className="w-16 h-20 object-cover rounded-lg shadow-md"
                        onError={(e) => {
                          e.currentTarget.src = getDefaultCoverImage();
                        }}
                      />
                    </div>
                    <div className="flex-1 space-y-2">
                      <CardTitle className="text-lg line-clamp-1 group-hover:text-primary transition-colors">
                        {review.book.title}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {review.book.author}
                      </p>
                      <div className="flex items-center gap-3">
                        {renderStars(review.rating)}
                        <Badge variant="secondary" className="text-xs">
                          {review.rating}/5
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <div className="bg-accent/30 rounded-lg p-4 border-l-4 border-warm-orange">
                    <p className="text-foreground leading-relaxed text-sm">
                      {truncateContent(review.content)}
                    </p>
                  </div>
                  
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <User className="h-3 w-3" />
                      <span>{review.profiles?.display_name || "익명"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3 w-3" />
                      <span>{new Date(review.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-primary text-primary hover:bg-primary hover:text-white group-hover:shadow-md transition-all"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/books/${review.book_id}/review`);
                      }}
                    >
                      <BookOpen className="h-3 w-3 mr-1" />
                      전체 읽기
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default PopularReviews;