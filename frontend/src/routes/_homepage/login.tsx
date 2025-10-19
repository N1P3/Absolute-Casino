import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { SubmitHandler, useForm } from "react-hook-form";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import Spinner from "@/components/ui/spinner";
import { useAuth } from "@/components/AuthProvider";

export const Route = createFileRoute("/_homepage/login")({
  component: SignIn,
});

type LoginForm = {
  login: string;
  password: string;
};

export default function SignIn() {
  const form = useForm<LoginForm>();
  const navigate = useNavigate({ from: "/login" });
  const { reload: reloadUserInfo } = useAuth();

  const submitForm: SubmitHandler<LoginForm> = async (data) => {
    try {
      const apiData = {
        login: data.login,
        password: data.password,
      };
      await api.post("/api/authenticate", apiData);
      await navigate({ to: "/" });
      reloadUserInfo();
    } catch {
      form.setError("root", { message: "Nie udało się zalogować." });
    }
  };

  return (
    <div className="min-h-[80vh] flex md:items-center justify-center mt-5 md:mt-6 mb-3">
      <Card className="md:p-5 bg-none flex flex-col items-center border-none shadow-none md:bg-gray-900 md:shadow-xl text-white">
        {/* <div className="bg-gradient-to-r from-amber-500 to-amber-600 flex flex-col gap-2 rounded-2xl text-black py-2 px-4 w-[90%]">
          <h4 className="text-2xl font-bold">Zaloguj się</h4>
          <p className="mt-1">Witaj ponownie, podaj dane logowania.</p>
        </div> */}
        <h1 className="text-left font-extrabold uppercase text-3xl italic">Logowanie</h1>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(submitForm)} className="mt-5 mb-2 w-80 max-w-screen-lg sm:w-96 flex flex-col px-8 gap-5">
            <FormField
              name="login"
              control={form.control}
              rules={{
                required: "Nazwa użytkownika jest wymagana",
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Login</FormLabel>
                  <FormControl>
                    <Input value={field.value} onChange={field.onChange} type="text" placeholder="janusz213" />
                  </FormControl>
                  <FormMessage className="text-red-500 text-xs" />
                </FormItem>
              )}
            />

            <FormField
              name="password"
              control={form.control}
              rules={{ required: "Hasło jest wymagane." }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hasło</FormLabel>
                  <FormControl>
                    <Input value={field.value} onChange={field.onChange} type="password" placeholder="********" />
                  </FormControl>
                  <FormMessage className="text-red-500 text-xs" />
                </FormItem>
              )}
            />

            {form.formState.errors.root && <div className="text-red-500 text-center mt-3 p-3 rounded-md">{form.formState.errors.root.message}</div>}

            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? <Spinner /> : "Zaloguj się"}
            </Button>
            <p className="mt-4 text-center">
              Nie masz jeszcze konta?
              <Button size="sm" className="ml-2" variant="outline" asChild>
                <a href="/register">Załóż je</a>
              </Button>
            </p>
          </form>
        </Form>
      </Card>
    </div>
  );
}
