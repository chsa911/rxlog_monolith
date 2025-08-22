import BooksTable from "../components/BooksTable";

export default function BooksPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Alle Bücher</h1>
      <BooksTable />
    </div>
  );
}
