import { t } from "@/messages";

export default function Home() {
  const locale = "en";
  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-4 py-12">
      <h1 className="text-3xl font-bold">{t(locale, "app.name")}</h1>
      <p className="text-lg">{t(locale, "app.tagline")}</p>
      <ul className="flex flex-col gap-3 text-lg">
        <li className="rounded-lg border p-4">{t(locale, "home.trader")}</li>
        <li className="rounded-lg border p-4">{t(locale, "home.officer")}</li>
        <li className="rounded-lg border p-4">{t(locale, "home.admin")}</li>
      </ul>
    </main>
  );
}
