async function main() {
  const list = await (await fetch('http://127.0.0.1:9223/json/list')).json();
  const page = list.find((t) => t.type === 'page');
  console.log('page url:', page?.url);
}
main();
