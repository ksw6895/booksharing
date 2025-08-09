import React, { useState, useEffect } from 'react';
import { MessageCircle, Check, X, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { ChatModal } from './ChatModal';
import logger from '@/utils/logger';

interface PendingRequest {
  id: string;
  book_id: string;
  borrower_id: string;
  created_at: string;
  book: {
    title: string;
    author: string;
  };
  borrower: {
    display_name: string;
  };
  last_message?: {
    message: string;
    created_at: string;
    sender_id: string;
  };
}

export const NotificationDropdown = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedChat, setSelectedChat] = useState<{
    userId: string;
    userName: string;
    bookTitle: string;
    transactionId: string;
  } | null>(null);

  const fetchPendingRequests = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          id,
          book_id,
          borrower_id,
          owner_id,
          created_at,
          books!inner (
            title,
            author
          )
        `)
        .or(`owner_id.eq.${user.id},borrower_id.eq.${user.id}`)
        .in('status', ['requested', 'approved'])
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Error fetching pending requests:', error);
        return;
      }

      // Get all involved user IDs
      const userIds = new Set<string>();
      data?.forEach(item => {
        userIds.add(item.borrower_id);
        userIds.add(item.owner_id);
      });
      
      // Get profiles
      let profiles: any[] = [];
      if (userIds.size > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, display_name')
          .in('user_id', Array.from(userIds));
        profiles = profilesData || [];
      }

      // Get last messages for each transaction
      const transactionIds = data?.map(item => item.id) || [];
      let lastMessages: any[] = [];
      
      if (transactionIds.length > 0) {
        const { data: messagesData } = await supabase
          .from('messages')
          .select('transaction_id, message, created_at, sender_id')
          .in('transaction_id', transactionIds)
          .order('created_at', { ascending: false });
        
        // Get only the latest message for each transaction
        const messagesByTransaction = new Map();
        messagesData?.forEach(msg => {
          if (!messagesByTransaction.has(msg.transaction_id)) {
            messagesByTransaction.set(msg.transaction_id, msg);
          }
        });
        lastMessages = Array.from(messagesByTransaction.values());
      }

      // Map the data to match our interface
      const mappedData = data?.map(item => {
        const otherUserId = item.owner_id === user.id ? item.borrower_id : item.owner_id;
        const lastMessage = lastMessages.find(msg => msg.transaction_id === item.id);
        
        return {
          id: item.id,
          book_id: item.book_id,
          borrower_id: otherUserId, // 상대방 ID로 설정
          created_at: item.created_at,
          book: {
            title: item.books?.title || '',
            author: item.books?.author || ''
          },
          borrower: {
            display_name: profiles.find(p => p.user_id === otherUserId)?.display_name || '익명'
          },
          last_message: lastMessage ? {
            message: lastMessage.message,
            created_at: lastMessage.created_at,
            sender_id: lastMessage.sender_id
          } : undefined
        };
      }) || [];

      setPendingRequests(mappedData);
    } catch (error) {
      logger.error('Error:', error);
    }
  };

  useEffect(() => {
    if (user) {
      fetchPendingRequests();
      
      // 실시간 transaction 구독 설정
      const channel = supabase
        .channel('schema-db-changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'transactions',
            filter: `owner_id=eq.${user.id}`
          },
          () => {
            fetchPendingRequests();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'transactions',
            filter: `borrower_id=eq.${user.id}`
          },
          () => {
            fetchPendingRequests();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'transactions'
          },
          () => {
            fetchPendingRequests();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages'
          },
          () => {
            fetchPendingRequests();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const handleRequestResponse = async (requestId: string, action: 'approved' | 'rejected') => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('transactions')
        .update({ status: action })
        .eq('id', requestId);

      if (error) {
        throw error;
      }

      toast({
        title: action === 'approved' ? '요청이 승인되었습니다' : '요청이 거절되었습니다',
        description: action === 'approved' ? '대여가 승인되었습니다.' : '대여 요청이 거절되었습니다.',
      });

      // 요청 목록 새로고침
      fetchPendingRequests();
    } catch (error) {
      logger.error('Error updating request:', error);
      toast({
        title: '오류가 발생했습니다',
        description: '요청 처리 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return '방금 전';
    if (diffInMinutes < 60) return `${diffInMinutes}분 전`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}시간 전`;
    return `${Math.floor(diffInMinutes / 1440)}일 전`;
  };

  const openChat = (request: PendingRequest) => {
    setSelectedChat({
      userId: request.borrower_id,
      userName: request.borrower?.display_name || '익명',
      bookTitle: request.book?.title || '',
      transactionId: request.id
    });
    setIsOpen(false); // 드롭다운 닫기
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <MessageCircle className="h-4 w-4" />
          {pendingRequests.length > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center"
            >
              {pendingRequests.length}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-96 max-h-[500px] overflow-y-auto" align="end">
        <DropdownMenuLabel className="text-sm font-semibold bg-accent/50 py-3 px-4 border-b">
          💬 메시지 ({pendingRequests.length})
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {pendingRequests.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            새로운 메시지가 없습니다
          </div>
        ) : (
          pendingRequests.map((request, index) => (
            <div key={request.id} className={`p-4 hover:bg-accent/30 transition-colors cursor-pointer ${index !== pendingRequests.length - 1 ? 'border-b' : ''}`}>
              <div className="flex items-start gap-3" onClick={() => openChat(request)}>
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="bg-accent/50 rounded-2xl p-3 mb-2">
                    <p className="text-sm font-medium text-foreground mb-1">
                      {request.borrower?.display_name || '익명'}
                    </p>
                    <p className="text-sm text-foreground leading-relaxed">
                      {request.last_message ? 
                        (request.last_message.sender_id === user?.id ? '나: ' : '') + request.last_message.message
                        : `📚 "${request.book?.title}" 책을 대여하고 싶습니다.`
                      }
                    </p>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      {request.last_message ? 
                        formatTimeAgo(request.last_message.created_at) 
                        : formatTimeAgo(request.created_at)
                      }
                    </p>
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant="default"
                        className="h-8 text-xs px-3 bg-green-600 hover:bg-green-700"
                        onClick={() => handleRequestResponse(request.id, 'approved')}
                        disabled={loading}
                      >
                        <Check className="h-3 w-3 mr-1" />
                        승인
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs px-3 border-red-200 text-red-600 hover:bg-red-50"
                        onClick={() => handleRequestResponse(request.id, 'rejected')}
                        disabled={loading}
                      >
                        <X className="h-3 w-3 mr-1" />
                        거절
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </DropdownMenuContent>
      
      {/* 채팅 모달 */}
      {selectedChat && (
        <ChatModal
          isOpen={!!selectedChat}
          onClose={() => setSelectedChat(null)}
          otherUserId={selectedChat.userId}
          otherUserName={selectedChat.userName}
          bookTitle={selectedChat.bookTitle}
          transactionId={selectedChat.transactionId}
        />
      )}
    </DropdownMenu>
  );
};