import { Button, type ButtonVariant } from "../components/Button";
import { useOpenLesson } from "./lesson";

// The Journey and Progress button that opens a Lesson through useOpenLesson.
export function OpenLessonButton({
  id,
  variant,
  className,
  children,
}: {
  id: string;
  variant?: ButtonVariant;
  className?: string | undefined;
  children: string;
}) {
  const open = useOpenLesson(id);
  return (
    <Button variant={variant} iconEnd="arrow" className={className} {...open}>
      {children}
    </Button>
  );
}
