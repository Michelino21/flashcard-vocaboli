import { component$ } from "@builder.io/qwik";
import {
  Form,
  routeAction$,
  z,
  zod$,
  type DocumentHead,
  type RequestHandler,
} from "@builder.io/qwik-city";
import { authenticate, createSession, getUser } from "~/lib/auth";

/** Chi è già loggato non ha bisogno del form */
export const onGet: RequestHandler = async (ev) => {
  if (await getUser(ev)) throw ev.redirect(302, "/");
};

export const useLogin = routeAction$(
  async ({ username, password }, ev) => {
    const user = await authenticate(ev, username, password);
    if (!user) return ev.fail(401, { message: "Utente o password non corretti" });
    await createSession(ev, user);
    throw ev.redirect(302, "/");
  },
  zod$({
    username: z.string().trim().min(1).max(64),
    password: z.string().min(1).max(200),
  }),
);

export default component$(() => {
  const login = useLogin();
  return (
    <section class="login">
      <h1>Accedi</h1>
      <p class="muted">Serve solo per segnare le risposte e modificare le parole.</p>
      <Form action={login}>
        <label>
          <span>Utente</span>
          <input name="username" autoComplete="username" autoCapitalize="off" required />
        </label>
        <label>
          <span>Password</span>
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        {login.value?.failed && (
          <p class="err" role="alert">
            {login.value.message ?? "Compila utente e password"}
          </p>
        )}
        <button class="btn btn-primary" type="submit" disabled={login.isRunning}>
          {login.isRunning ? "Accedo…" : "Accedi"}
        </button>
      </Form>
    </section>
  );
});

export const head: DocumentHead = {
  title: "Accedi · Vocaboli",
  meta: [{ name: "robots", content: "noindex" }],
};
