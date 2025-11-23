// frontend/src/components/ContactDialog.tsx
import { FC } from "react";
import { Button } from "./ui/button";

interface ContactDialogProps {
  open: boolean;
  onClose: () => void;
}

const ContactDialog: FC<ContactDialogProps> = ({ open, onClose }) => {
  if (!open) return null;

  const handleMailClick = () => {
    window.location.href =
      "mailto:sportsmap.team@example.com?subject=스포츠맵 문의";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold">문의하기</h2>
        <p className="mt-2 text-sm text-slate-600">
          서비스 이용 중 궁금한 점이나 제안하고 싶은 아이디어가 있다면 아래
          방법으로 알려주세요.
        </p>

        <div className="mt-4 flex flex-col gap-3">
          <Button variant="outline" onClick={handleMailClick}>
            이메일로 문의하기
          </Button>
          <Button variant="outline" asChild>
            <a
              href="https://forms.gle/your-google-form"
              target="_blank"
              rel="noreferrer"
            >
              구글 폼으로 문의 남기기
            </a>
          </Button>
        </div>

        <button
          className="mt-4 text-xs text-slate-500 hover:underline"
          onClick={onClose}
        >
          닫기
        </button>
      </div>
    </div>
  );
};

export default ContactDialog;
