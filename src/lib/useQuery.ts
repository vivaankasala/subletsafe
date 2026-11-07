import { useEffect, useState } from "react";
import { errorMessage } from "./supabase";
export function useQuery<T>(load: () => Promise<T>, key: string) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    load()
      .then((value) => {
        if (active) setData(value);
      })
      .catch((e) => {
        if (active) setError(errorMessage(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // The caller provides a serialized dependency key; fetch closures intentionally refresh only with it.
  }, [key, version]);
  return { data, error, loading, reload: () => setVersion((v) => v + 1) };
}
