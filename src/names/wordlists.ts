// Flavor × Dessert wordlists for auto-generated agent names like
// "Chocolate-Sundae" or "Java-Chip-Ice-Cream-Cake". Multi-word entries
// are stored pre-hyphenated so combining with a single `-` separator
// yields a coherent hyphenated name.

export const FLAVORS: readonly string[] = [
  'Chocolate',
  'Vanilla',
  'Java-Chip',
  'Espresso',
  'Coffee',
  'Single',
  'Double',
  'Triple',
  'Mint-Chip',
  'Fudge-Swirl',
  'Oreo',
  'Cookie',
  'Caramel',
  'Mocha',
  'Rocky-Road',
  'Cookie-Dough',
  'Decaf',
  'Quad',
];

export const DESSERTS: readonly string[] = [
  'Hot-Fudge-Sundae',
  'Chocolate-Milkshake',
  'Chips-Ahoy',
  'Amigo',
  'Black-Forest-Cake',
  'Ice-Cream-Cake',
  'Ice-Cream-Soda',
  'Biscotti',
  'Affogato',
  'Latte',
  'Cappuccino',
  'Frappuccino',
  'Root-Beer-Float',
  'Ice-Cream-Cone',
  'Cannoli',
  'Eclair',
  'Cupcake',
  'Brownie',
];

// Human-readable disambiguator appended when two agents roll the same
// flavor + dessert combination. After the 19th conflict the generator
// falls back to a hex suffix — in practice never reached.
export const NUMBER_WORDS: readonly string[] = [
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
  'Twenty',
];
