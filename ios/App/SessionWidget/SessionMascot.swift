import SwiftUI

/// The bunny or the kitty, drawn with the same shapes and numbers as `Mascot.svelte` (a 120 x 120 picture),
/// so the lock screen shows the friend you picked in Settings.
struct SessionMascot: View {
    let kind: String   // "bunny" or "kitty"
    let mood: String   // "happy", "alert" or "done"
    var size: CGFloat = 44

    private let outline = Color(red: 0.965, green: 0.663, blue: 0.788)   // #f6a9c9
    private let ink = Color(red: 0.357, green: 0.165, blue: 0.278)       // #5b2a47
    private let pinkNose = Color(red: 1.0, green: 0.494, blue: 0.714)    // #ff7eb6
    private let innerEar = Color(red: 1.0, green: 0.714, blue: 0.827)    // #ffb6d3
    private let blush = Color(red: 1.0, green: 0.624, blue: 0.776)       // #ff9fc6
    private let star = Color(red: 1.0, green: 0.31, blue: 0.604)         // #ff4f9a

    private func ellipse(_ cx: CGFloat, _ cy: CGFloat, _ rx: CGFloat, _ ry: CGFloat) -> Path {
        Path(ellipseIn: CGRect(x: cx - rx, y: cy - ry, width: rx * 2, height: ry * 2))
    }

    private func triangle(_ a: (CGFloat, CGFloat), _ b: (CGFloat, CGFloat), _ c: (CGFloat, CGFloat)) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: a.0, y: a.1))
        p.addLine(to: CGPoint(x: b.0, y: b.1))
        p.addLine(to: CGPoint(x: c.0, y: c.1))
        p.closeSubpath()
        return p
    }

    var body: some View {
        Canvas { context, canvasSize in
            context.scaleBy(x: canvasSize.width / 120, y: canvasSize.height / 120)
            let line = StrokeStyle(lineWidth: 2.5, lineJoin: .round)
            let round = { (width: CGFloat) in StrokeStyle(lineWidth: width, lineCap: .round, lineJoin: .round) }

            func shape(_ path: Path, fill: Color, stroke: Color? = nil, style: StrokeStyle = line) {
                context.fill(path, with: .color(fill))
                if let stroke { context.stroke(path, with: .color(stroke), style: style) }
            }

            // ears
            if kind == "kitty" {
                shape(triangle((22, 64), (26, 18), (64, 48)), fill: .white, stroke: outline)
                shape(triangle((30, 54), (31, 31), (50, 47)), fill: innerEar, stroke: innerEar, style: StrokeStyle(lineWidth: 1, lineJoin: .round))
                shape(triangle((98, 64), (94, 18), (56, 48)), fill: .white, stroke: outline)
                shape(triangle((90, 54), (89, 31), (70, 47)), fill: innerEar, stroke: innerEar, style: StrokeStyle(lineWidth: 1, lineJoin: .round))
            } else {
                shape(ellipse(40, 34, 13, 30), fill: .white, stroke: outline)
                shape(ellipse(40, 36, 6.5, 20), fill: innerEar, stroke: innerEar, style: StrokeStyle(lineWidth: 1))
                shape(ellipse(80, 34, 13, 30), fill: .white, stroke: outline)
                shape(ellipse(80, 36, 6.5, 20), fill: innerEar, stroke: innerEar, style: StrokeStyle(lineWidth: 1))
            }

            // head
            shape(ellipse(60, 80, 42, 33), fill: .white, stroke: outline)

            if kind == "kitty" {
                var whiskers = Path()
                for (from, to) in [((6, 79), (31, 83)), ((8, 92), (31, 89)), ((114, 79), (89, 83)), ((112, 92), (89, 89))] {
                    whiskers.move(to: CGPoint(x: from.0, y: from.1))
                    whiskers.addLine(to: CGPoint(x: to.0, y: to.1))
                }
                context.stroke(whiskers, with: .color(outline), style: round(2))
            }

            // cheeks
            context.fill(ellipse(35, 90, 8, 5), with: .color(blush.opacity(0.55)))
            context.fill(ellipse(85, 90, 8, 5), with: .color(blush.opacity(0.55)))

            // eyes
            switch mood {
            case "alert":
                for x in [46.0, 74.0] {
                    context.fill(ellipse(x, 80, 5, 5), with: .color(ink))
                    context.fill(ellipse(x + 2, 78, 1.8, 1.8), with: .color(.white))
                }
            case "done":
                for x in [46.0, 74.0] {
                    context.draw(Text("★").font(.system(size: 20)).foregroundColor(star), at: CGPoint(x: x, y: 78))
                }
            default:
                var eyes = Path()
                for x in [41.0, 69.0] {
                    eyes.move(to: CGPoint(x: x, y: 80))
                    eyes.addQuadCurve(to: CGPoint(x: x + 10, y: 80), control: CGPoint(x: x + 5, y: 73))
                }
                context.stroke(eyes, with: .color(ink), style: round(3))
            }

            // nose
            if kind == "kitty" {
                shape(triangle((56, 87.5), (64, 87.5), (60, 92.5)), fill: pinkNose, stroke: pinkNose, style: StrokeStyle(lineWidth: 2, lineJoin: .round))
            } else {
                context.fill(ellipse(60, 90, 3.5, 2.6), with: .color(pinkNose))
            }

            // mouth
            var mouth = Path()
            mouth.move(to: CGPoint(x: 60, y: 93))
            mouth.addQuadCurve(to: CGPoint(x: 50, y: 95), control: CGPoint(x: 55, y: 100))
            mouth.move(to: CGPoint(x: 60, y: 93))
            mouth.addQuadCurve(to: CGPoint(x: 70, y: 95), control: CGPoint(x: 65, y: 100))
            context.stroke(mouth, with: .color(ink), style: round(2.4))
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}
