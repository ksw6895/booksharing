import React, { memo } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, User, Calendar, DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

interface Book {
  id: string;
  title: string;
  author: string;
  cover_image?: string;
  status: 'available' | 'sold' | 'rented';
  price?: number;
  rental_fee?: number;
  created_at: string;
  profiles?: {
    display_name?: string;
    address?: string;
  };
}

interface OptimizedBookCardProps {
  book: Book;
  onSelect?: (bookId: string) => void;
}

const OptimizedBookCard = memo<OptimizedBookCardProps>(
  ({ book, onSelect }) => {
    const navigate = useNavigate();

    const handleClick = () => {
      if (onSelect) {
        onSelect(book.id);
      } else {
        navigate(`/books/${book.id}`);
      }
    };

    const getStatusBadge = () => {
      const statusMap = {
        available: { label: '거래 가능', variant: 'default' as const },
        sold: { label: '판매 완료', variant: 'secondary' as const },
        rented: { label: '대여 중', variant: 'outline' as const },
      };
      
      const status = statusMap[book.status];
      return (
        <Badge variant={status.variant} aria-label={`상태: ${status.label}`}>
          {status.label}
        </Badge>
      );
    };

    const formatPrice = (price?: number) => {
      if (!price) return '무료';
      return `${price.toLocaleString()}원`;
    };

    return (
      <Card 
        className="cursor-pointer hover:shadow-lg transition-shadow duration-200"
        onClick={handleClick}
        role="article"
        aria-label={`${book.title} - ${book.author}`}
      >
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start gap-2">
            <CardTitle className="text-lg line-clamp-2 flex-1">
              {book.title}
            </CardTitle>
            {getStatusBadge()}
          </div>
        </CardHeader>
        
        <CardContent className="space-y-3">
          {book.cover_image && (
            <div className="aspect-[3/4] w-full overflow-hidden rounded-md bg-muted">
              <img
                src={book.cover_image}
                alt={`${book.title} 표지`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          )}
          
          <div className="space-y-2 text-sm">
            <p className="font-medium text-muted-foreground">
              {book.author}
            </p>
            
            {book.profiles?.display_name && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <User className="h-3 w-3" aria-hidden="true" />
                <span>{book.profiles.display_name}</span>
              </div>
            )}
            
            {book.profiles?.address && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <MapPin className="h-3 w-3" aria-hidden="true" />
                <span className="truncate">{book.profiles.address}</span>
              </div>
            )}
            
            <div className="flex items-center gap-1 text-muted-foreground">
              <Calendar className="h-3 w-3" aria-hidden="true" />
              <span>
                {formatDistanceToNow(new Date(book.created_at), {
                  addSuffix: true,
                  locale: ko,
                })}
              </span>
            </div>
          </div>
        </CardContent>
        
        <CardFooter className="pt-3">
          <div className="w-full space-y-2">
            {(book.price || book.rental_fee) && (
              <div className="flex items-center justify-between text-sm">
                <DollarSign className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                <div className="flex gap-3">
                  {book.price && (
                    <span>
                      <span className="text-muted-foreground">판매: </span>
                      <span className="font-semibold">{formatPrice(book.price)}</span>
                    </span>
                  )}
                  {book.rental_fee && (
                    <span>
                      <span className="text-muted-foreground">대여: </span>
                      <span className="font-semibold">{formatPrice(book.rental_fee)}</span>
                    </span>
                  )}
                </div>
              </div>
            )}
            
            <Button 
              className="w-full"
              variant={book.status === 'available' ? 'default' : 'outline'}
              disabled={book.status !== 'available'}
              aria-label={`${book.title} 상세보기`}
            >
              상세보기
            </Button>
          </div>
        </CardFooter>
      </Card>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison function for optimization
    return (
      prevProps.book.id === nextProps.book.id &&
      prevProps.book.status === nextProps.book.status &&
      prevProps.book.price === nextProps.book.price &&
      prevProps.book.rental_fee === nextProps.book.rental_fee
    );
  }
);

OptimizedBookCard.displayName = 'OptimizedBookCard';

export default OptimizedBookCard;