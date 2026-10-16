import { createContext, useContext, useMemo, useState } from "react";
import { decodeUser, tokenStore } from "./api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => decodeUser());

  const value = useMemo(
    () => ({
      user,
      login(tokens) {
        tokenStore.set(tokens.access_token, tokens.refresh_token);
        setUser(decodeUser());
      },
      logout() {
        tokenStore.clear();
        setUser(null);
      },
    }),
    [user]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

// eslint-disable-next-line react/only-export-components -- useAuth sengaja menempel di file providernya; terlalu berat memecah satu hook jadi file sendiri
export function useAuth() {
  return useContext(AuthCtx);
}
