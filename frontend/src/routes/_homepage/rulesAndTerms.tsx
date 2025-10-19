import { createFileRoute } from "@tanstack/react-router";

const regulations = [
  {
    title: "1. Postanowienia ogólne",
    content: `1.1. Regulamin określa zasady korzystania z serwisu Absolute Casino, który jest dostępny pod adresem URL: todo.
              1.2. Użytkownik zobowiązuje się do przestrzegania niniejszego regulaminu w trakcie korzystania z serwisu. 
              1.3. Korzystanie z serwisu oznacza akceptację regulaminu oraz wszelkich zmian w nim wprowadzonych. 
              1.4. Serwis zastrzega sobie prawo do wprowadzania zmian w regulaminie, o czym użytkownicy będą informowani za pośrednictwem wiadomości e-mail lub komunikatów w serwisie.`,
  },
  {
    title: "2. Rejestracja konta",
    content: `2.1. Aby grać w gry oferowane w serwisie, Użytkownik musi zarejestrować konto, co wymaga podania danych osobowych. 
              2.2. Rejestracja konta jest możliwa tylko dla osób pełnoletnich, które mają co najmniej 18 lat. 
              2.3. Użytkownik zobowiązuje się do podania prawdziwych i aktualnych danych podczas rejestracji. 
              2.4. Serwis zastrzega sobie prawo do weryfikacji danych użytkowników oraz do zablokowania konta w przypadku stwierdzenia nieprawidłowości.`,
  },
  {
    title: "3. Odpowiedzialna gra",
    content: `3.1. Serwis promuje odpowiedzialne granie i zaleca, aby użytkownicy ustalali limity dotyczące czasu gry oraz wydatków finansowych. 
              3.2. Użytkownicy mogą skorzystać z opcji samowykluczenia w celu ochrony przed uzależnieniem od hazardu. 
              3.3. Serwis nie ponosi odpowiedzialności za ewentualne straty poniesione przez użytkowników w wyniku nieodpowiedzialnego grania.`,
  },
  {
    title: "4. Ochrona danych osobowych",
    content: `4.1. Administrator serwisu zobowiązuje się do ochrony danych osobowych użytkowników zgodnie z obowiązującymi przepisami prawa, w tym z ustawą o ochronie danych osobowych. 
              4.2. Użytkownicy mają prawo dostępu do swoich danych osobowych oraz do ich poprawiania. 
              4.3. Dane osobowe użytkowników są przetwarzane wyłącznie w celach związanych z działalnością serwisu oraz w celu realizacji umowy. 
              4.4. Serwis stosuje odpowiednie środki techniczne i organizacyjne w celu ochrony danych przed nieuprawnionym dostępem.`,
  },
  {
    title: "5. Zasady korzystania z serwisu",
    content: `5.1. Użytkownik zobowiązuje się do korzystania z serwisu w sposób zgodny z prawem oraz niniejszym regulaminem. 
              5.2. Niedopuszczalne jest wykorzystywanie serwisu do działań niezgodnych z prawem, w tym do oszustw, manipulacji lub innych nieuczciwych praktyk. 
              5.3. Użytkownik jest odpowiedzialny za wszelkie działania podejmowane na swoim koncie i zobowiązuje się do nieudostępniania swojego hasła osobom trzecim.`,
  },
  {
    title: "6. Zmiany regulaminu",
    content: `6.1. Administrator ma prawo do zmiany regulaminu w dowolnym czasie, w tym w celu dostosowania go do obowiązujących przepisów prawa. 
              6.2. O zmianach regulaminu użytkownicy będą informowani za pośrednictwem serwisu lub wiadomości e-mail. 
              6.3. Użytkownicy, którzy nie akceptują zmian, mają prawo do usunięcia swojego konta. 
              6.4. Zmiany regulaminu wchodzą w życie z dniem ich opublikowania na stronie serwisu.`,
  },
  {
    title: "7. Prawa użytkownika",
    content: `7.1. Użytkownik ma prawo do korzystania z serwisu zgodnie z regulaminem oraz przepisami prawa. 
              7.2. Użytkownik ma prawo do składania reklamacji dotyczących działania serwisu. 
              7.3. Reklamacje należy składać na adres e-mail: kontakt@twojastrona.pl, a administrator odpowiada w terminie 14 dni roboczych.`,
  },
  {
    title: "8. Odpowiedzialność",
    content: `8.1. Serwis nie ponosi odpowiedzialności za przerwy w działaniu, błędy techniczne, ani za straty poniesione przez użytkowników w wyniku korzystania z serwisu. 
              8.2. Użytkownik korzysta z serwisu na własne ryzyko i ponosi odpowiedzialność za swoje działania oraz decyzje dotyczące gry. 
              8.3. Wszelkie spory powstałe w związku z korzystaniem z serwisu będą rozstrzygane zgodnie z obowiązującym prawem.`,
  },
  {
    title: "9. Postanowienia końcowe",
    content: `9.1. Regulamin wchodzi w życie z dniem jego opublikowania na stronie serwisu. 
              9.2. W sprawach nieuregulowanych regulaminem zastosowanie mają przepisy prawa cywilnego. 
              9.3. Wszelkie umowy zawierane przez użytkowników są zgodne z przepisami prawa obowiązującymi w kraju siedziby administratora.`,
  },
];

export const Route = createFileRoute("/_homepage/rulesAndTerms")({
  component: () => Regulations(),
});

function RegulationSection({ title, content }) {
  return (
    <div className="flex flex-col justify-start select-none transition p-0.5 w-full">
      <div className="bg-black bg-opacity-60 p-4 rounded-lg">
        <h2 className="text-amber-500 text-xl font-bold mb-2">{title}</h2>
        <p className="text-white text-base">{content}</p>
      </div>
    </div>
  );
}

export default function Regulations() {
  return (
    <div className="w-4/6 text-white mx-auto rounded-lg bg-gray-900 p-4 my-7">
      <h1 className="font-extrabold uppercase text-3xl italic">Regulamin Serwisu</h1>
      <hr className="border-amber-400 m-1" />

      <div className="flex justify-center">
        <div className="w-[95%] flex flex-wrap justify-center md:justify-start mt-2">
          {regulations.map((r) => {
            return <RegulationSection title={r.title} content={r.content} />;
          })}
        </div>
      </div>
    </div>
  );
}
