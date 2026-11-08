import { useId, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
};
export function PasswordField({
  label,
  id,
  name = "password",
  ...props
}: Props) {
  const generatedId = useId(),
    fieldId = id || generatedId;
  const [visible, setVisible] = useState(false);
  return (
    <div className="password-field">
      <label htmlFor={fieldId}>{label}</label>
      <div className="password-control">
        <input
          {...props}
          id={fieldId}
          name={name}
          type={visible ? "text" : "password"}
        />
        <button
          className="password-toggle"
          type="button"
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          aria-controls={fieldId}
          onClick={() => setVisible((value) => !value)}
        >
          {visible ? (
            <EyeOff size={19} aria-hidden="true" />
          ) : (
            <Eye size={19} aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
}
