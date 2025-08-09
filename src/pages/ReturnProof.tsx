import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Upload, Camera, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import logger from '@/utils/logger';

interface TransactionDetail {
  id: string;
  status: string;
  book: {
    id: string;
    title: string;
    author: string;
    cover_image_url: string | null;
    transaction_type: string;
  };
  borrower: {
    display_name: string | null;
  };
}

const ReturnProof = () => {
  const { transactionId } = useParams<{ transactionId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [transaction, setTransaction] = useState<TransactionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  useEffect(() => {
    if (!transactionId) {
      navigate("/my");
      return;
    }
    fetchTransactionDetail();
  }, [transactionId, navigate]);

  const fetchTransactionDetail = async () => {
    if (!transactionId || !user) return;

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          book:book_id (
            id,
            title,
            author,
            cover_image_url,
            transaction_type
          ),
          borrower:borrower_id (
            display_name
          )
        `)
        .eq('id', transactionId)
        .eq('owner_id', user.id) // Only owner can upload return proof
        .single();

      if (error) {
        logger.error('Error fetching transaction:', error);
        toast({
          title: "거래 정보 로딩 실패",
          description: "거래 정보를 불러올 수 없습니다.",
          variant: "destructive",
        });
        navigate("/my");
        return;
      }

      if (data.status === 'completed') {
        toast({
          title: "이미 완료된 거래입니다",
          description: "이 거래는 이미 완료되었습니다.",
          variant: "destructive",
        });
        navigate("/my");
        return;
      }

      setTransaction(data as any);
    } catch (error) {
      logger.error('Error:', error);
      toast({
        title: "오류가 발생했습니다",
        description: "다시 시도해 주세요.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadReturnProof = async (): Promise<string | null> => {
    if (!imageFile || !user || !transaction) return null;

    try {
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${user.id}/${transaction.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('return-proofs')
        .upload(fileName, imageFile);

      if (uploadError) {
        logger.error('Upload error:', uploadError);
        return null;
      }

      const { data } = supabase.storage
        .from('return-proofs')
        .getPublicUrl(fileName);

      return data.publicUrl;
    } catch (error) {
      logger.error('Error uploading image:', error);
      return null;
    }
  };

  const handleSubmitReturnProof = async () => {
    if (!imageFile) {
      toast({
        title: "사진을 선택해주세요",
        description: "반납 인증을 위해 책 사진을 업로드해주세요.",
        variant: "destructive",
      });
      return;
    }

    if (!transaction) return;

    setUploading(true);

    try {
      // Upload image
      const imageUrl = await uploadReturnProof();
      if (!imageUrl) {
        toast({
          title: "이미지 업로드 실패",
          description: "이미지 업로드 중 오류가 발생했습니다.",
          variant: "destructive",
        });
        setUploading(false);
        return;
      }

      // Update transaction with return proof image and complete status
      const { error: updateError } = await supabase
        .from('transactions')
        .update({
          return_proof_image_url: imageUrl,
          status: 'completed'
        })
        .eq('id', transaction.id);

      if (updateError) {
        toast({
          title: "반납 인증 실패",
          description: updateError.message,
          variant: "destructive",
        });
        setUploading(false);
        return;
      }

      // Update book status back to available (for rental) or keep sold (for sale)
      if (transaction.book.transaction_type === 'rental') {
        await supabase
          .from('books')
          .update({ status: 'available' })
          .eq('id', transaction.book.id);
      }

      toast({
        title: "반납 인증 완료",
        description: "반납이 성공적으로 인증되었습니다.",
      });

      navigate("/my");
    } catch (error) {
      toast({
        title: "오류가 발생했습니다",
        description: "다시 시도해 주세요.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const getDefaultCoverImage = () => {
    return "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=300&h=400&fit=crop&crop=center";
  };

  if (!user) {
    navigate("/auth");
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <p className="text-muted-foreground">거래 정보를 불러오는 중...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!transaction) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <p className="text-muted-foreground">거래를 찾을 수 없습니다.</p>
            <Button onClick={() => navigate("/my")} className="mt-4">
              내 책장으로 돌아가기
            </Button>
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
          <div className="flex items-center gap-4 mb-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/my")}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              내 책장으로
            </Button>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">반납 인증</h1>
            </div>
          </div>

          {/* Book Info */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>반납받은 책 정보</CardTitle>
              <CardDescription>
                아래 책이 정상적으로 반납되었는지 확인하고 사진을 업로드해주세요
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="w-16 h-20 bg-muted rounded overflow-hidden flex-shrink-0">
                  <img 
                    src={transaction.book.cover_image_url || getDefaultCoverImage()} 
                    alt={transaction.book.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = getDefaultCoverImage();
                    }}
                  />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{transaction.book.title}</h3>
                  <p className="text-sm text-muted-foreground">{transaction.book.author}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    대여자: {transaction.borrower?.display_name || "익명"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Return Proof Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                반납 인증 사진 업로드
              </CardTitle>
              <CardDescription>
                반납받은 책의 사진을 촬영하여 업로드해주세요. 책의 상태를 확인할 수 있는 사진이어야 합니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Image Preview */}
              <div className="space-y-2">
                <Label htmlFor="return-proof-image">반납 인증 사진</Label>
                <div className="flex flex-col items-center gap-4">
                  {imagePreview ? (
                    <div className="relative">
                      <img
                        src={imagePreview}
                        alt="Return proof preview"
                        className="w-full max-w-md h-64 object-cover rounded-md border border-border"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={() => {
                          setImageFile(null);
                          setImagePreview(null);
                        }}
                      >
                        ✕
                      </Button>
                    </div>
                  ) : (
                    <div className="w-full max-w-md h-64 border-2 border-dashed border-border rounded-md flex items-center justify-center">
                      <div className="text-center">
                        <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-sm text-muted-foreground">
                          반납받은 책 사진을 업로드하세요
                        </p>
                      </div>
                    </div>
                  )}
                  <Input
                    id="return-proof-image"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="w-full"
                  />
                </div>
              </div>

              {/* Guidelines */}
              <div className="p-4 bg-accent rounded-lg">
                <h4 className="font-medium mb-2">사진 촬영 가이드</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• 책의 표지와 전체적인 상태가 잘 보이도록 촬영해주세요</li>
                  <li>• 조명이 충분한 곳에서 선명하게 촬영해주세요</li>
                  <li>• 책에 손상이 있다면 해당 부분도 포함해서 촬영해주세요</li>
                </ul>
              </div>

              {/* Submit Button */}
              <Button 
                onClick={handleSubmitReturnProof}
                className="w-full" 
                disabled={uploading || !imageFile}
                variant="warm"
                size="lg"
              >
                {uploading ? "반납 인증 처리 중..." : "반납 인증 완료"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default ReturnProof;
