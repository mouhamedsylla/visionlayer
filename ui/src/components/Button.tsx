import type { ButtonHTMLAttributes } from "react";
import styles from "./Button.module.css";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "dark" | "tint";
}

export function Button({ variant = "dark", className, ...rest }: Props) {
  return <button type="button" className={`${styles.button} ${styles[variant]} ${className ?? ""}`} {...rest} />;
}
