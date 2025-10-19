import { Button } from "@/components/ui/button.tsx";
import { createFileRoute } from "@tanstack/react-router";
import instructionsConfig from "@/instructionsConfig";

export const Route = createFileRoute("/_homepage/instructions/$instruction")({
  component: Instructions,
});

function InstructionSection({ title, content }) {
  return (
    <div className="flex flex-col justify-start select-none transition p-0.5 w-full">
      <div className="bg-black bg-opacity-60 p-4 rounded-lg">
        <h2 className="text-amber-500 text-xl font-bold mb-2">{title}</h2>
        <p className="text-white text-base whitespace-pre-line">{content}</p>
      </div>
    </div>
  );
}

function Instructions() {
  const { instruction } = Route.useParams();
  const gameInstructions = instructionsConfig[instruction];

  const launchGame = () => {
    window.open(`/game/${instruction}`, instruction, `scrollbars=no,status=no,location=no,toolbar=no,menubar=no`);
  };

  return (
    <div className="w-4/6 text-white mx-auto rounded-lg bg-gray-900 p-4 my-7">
      <h1 className="font-extrabold uppercase text-3xl italic text-center">{gameInstructions.title}</h1>
      <hr className="border-amber-400 m-1" />

      <div className="flex justify-center">
        <div className="w-[95%] flex flex-wrap justify-center md:justify-start mt-2">
          {gameInstructions.items.map((rule, index) => (
            <InstructionSection key={index} title={rule.title} content={rule.content} />
          ))}

          <Button variant={"default"} className="bg-amber-500 mx-auto mt-3 hover:bg-amber-600" size="lg" onClick={launchGame}>
            Zagraj
          </Button>
        </div>
      </div>
    </div>
  );
}
