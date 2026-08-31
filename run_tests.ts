import { runAllScientificTests } from './src/scientific/tests/scientificEngine.test';
import { runGate22RegressionTests } from './src/scientific/tests/gate22_regressions.test';

console.log('================================================================');
console.log('1. EXÉCUTION DE LA SUITE DE TESTS SCIENTIFIQUES GÉNÉRALE (44 TESTS)');
console.log('================================================================');
const suite1 = runAllScientificTests();
console.log(`Résultats Suite Générale : ${suite1.summary.passed} / ${suite1.summary.total} réussis.`);
if (suite1.summary.failed > 0) {
  console.error('Échecs détectés dans la suite générale :');
  suite1.results.filter((r) => !r.passed).forEach((r) => {
    console.error(`- Test #${r.id} [${r.name}]: attendu '${r.expected}', obtenu '${r.actual}'`);
  });
}

console.log('\n================================================================');
console.log('2. EXÉCUTION DE LA SUITE DE TESTS DE RÉGRESSION GATE 2.2');
console.log('================================================================');
const suite2 = runGate22RegressionTests();
console.log(`Résultats Suite GATE 2.2 : ${suite2.summary.passed} / ${suite2.summary.total} réussis.`);
suite2.results.forEach((r) => {
  console.log(`[${r.passed ? 'PASS ✓' : 'FAIL ✗'}] [${r.category}] ${r.id} - ${r.name}`);
  if (!r.passed) {
    console.error(`   Attendu: ${r.expected}`);
    console.error(`   Obtenu:  ${r.actual}`);
  }
});

const totalFailed = suite1.summary.failed + suite2.summary.failed;
if (totalFailed > 0) {
  console.error(`\n❌ Échec total : ${totalFailed} tests ont échoué.`);
  process.exit(1);
} else {
  console.log(`\n🎉 TOUS LES TESTS SONT AU VERT ! Total : ${suite1.summary.total + suite2.summary.total} tests validés.`);
  process.exit(0);
}
