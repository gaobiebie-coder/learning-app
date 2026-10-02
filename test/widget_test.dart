import 'package:flutter_test/flutter_test.dart';
import 'package:learning_app/main.dart';

void main() {
  testWidgets('App 启动后显示首页和底部导航', (tester) async {
    await tester.pumpWidget(const LearningApp());
    expect(find.text('今日目标'), findsOneWidget);
    expect(find.text('首页'), findsOneWidget);
    expect(find.text('学习'), findsOneWidget);
    expect(find.text('我的'), findsOneWidget);
  });

  testWidgets('点击单词卡可以翻面查看释义', (tester) async {
    await tester.pumpWidget(const LearningApp());
    expect(find.text('persistence'), findsOneWidget);
    await tester.tap(find.text('persistence'));
    await tester.pump();
    expect(find.text('n. 坚持；毅力'), findsOneWidget);
  });
}
