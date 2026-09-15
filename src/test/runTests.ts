import { runAllRiskEngineTests } from "../services/__tests__/riskEngine.test.ts";
import { runAllGraphTests } from "../services/__tests__/graph.test.ts";
import { runAllEventHashTests } from "../services/__tests__/eventHash.test.ts";

async function runSuite() {
  console.log("==================================================");
  console.log(" TRACESHIELD VERIFICATION & ENGINE TEST SUITE");
  console.log("==================================================\n");

  const eventHash = await runAllEventHashTests();
  const risk = runAllRiskEngineTests();
  const graph = runAllGraphTests();

  const results = [...eventHash.results, ...risk.results, ...graph.results];
  const passed = eventHash.passed + risk.passed + graph.passed;
  const failed = eventHash.failed + risk.failed + graph.failed;

  results.forEach((r, i) => {
    const icon = r.success ? "✓ PASS" : "✗ FAIL";
    console.log(`[${String(i + 1).padStart(2, "0")}] ${icon}: ${r.name}`);
    if (!r.success && r.details) {
      console.log(`     Error details: ${r.details}`);
    }
  });

  console.log("\n--------------------------------------------------");
  console.log(` SUMMARY: ${passed} passed, ${failed} failed out of ${results.length} tests.`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runSuite().catch((err) => {
  console.error("Test runner failed:", err);
  process.exit(1);
});
