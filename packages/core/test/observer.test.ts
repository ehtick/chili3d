// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { DeepObserver, type IPropertyChanged, Observable } from "../src";

class TestClassA extends Observable {
    get propA() {
        return this.getPrivateValue("propA", 1);
    }
    set propA(value: number) {
        this.setProperty("propA", value);
    }
}

class TestClassB extends Observable {
    get propBV() {
        return this.getPrivateValue("propBV", 1);
    }
    set propBV(value: number) {
        this.setProperty("propBV", value);
    }

    get propB() {
        return this.getPrivateValue("propB", new TestClassA());
    }
    set propB(value: TestClassA | undefined) {
        this.setProperty("propB", value);
    }
}

class TestClassC extends Observable {
    get propCV() {
        return this.getPrivateValue("propCV", 1);
    }
    set propCV(value: number) {
        this.setProperty("propCV", value);
    }

    get propC() {
        return this.getPrivateValue("propC", new TestClassB());
    }
    set propC(value: TestClassB | undefined) {
        this.setProperty("propC", value);
    }
}

test("should notify when a property changes", () => {
    const t = new TestClassA();
    let callCount = 0;
    let changedProperty: string | undefined;
    let changedSource: IPropertyChanged | undefined;
    t.onPropertyChanged((p, s, o) => {
        callCount++;
        changedProperty = p;
        changedSource = s;
    });
    t.propA = 2;
    expect(callCount).toBe(1);
    expect(changedProperty).toBe("propA");
    expect((changedSource as any)[changedProperty!]).toBe(2);
});

test("deep observer", () => {
    const c = new TestClassC();
    let targetProperty: string | undefined;
    const onPropertyChanged = (p: string, s: IPropertyChanged, o: any) => {
        targetProperty = p;
    };
    const a = new TestClassA();
    DeepObserver.addDeepPropertyChangedHandler(c, onPropertyChanged);
    c.propC!.propB = a;
    expect(targetProperty).toBe("propC.propB");
    a.propA = 2;
    expect(targetProperty).toBe("propC.propB.propA");

    c.propC = undefined;
    expect(targetProperty).toBe("propC");
    a.propA = 3;
    expect(targetProperty).toBe("propC");

    const b = new TestClassB();
    c.propC = b;
    expect(targetProperty).toBe("propC");
    b.propB = a;
    expect(targetProperty).toBe("propC.propB");
    a.propA = 2;
    expect(targetProperty).toBe("propC.propB.propA");

    b.propB = undefined;
    expect(targetProperty).toBe("propC.propB");
    a.propA = 3;
    expect(targetProperty).toBe("propC.propB");

    b.propB = a;
    expect(targetProperty).toBe("propC.propB");
    a.propA = 2;
    expect(targetProperty).toBe("propC.propB.propA");
});
