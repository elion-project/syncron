import { describe, expect, it } from "@jest/globals";
import * as ModelEvent from "@node-elion/syncron";
import { getDbDriver, ModelEventPublisherAnalyzer } from "./utils";

describe("ModelEventPublisher", () => {
    const db = getDbDriver();
    const modelName: string = "test";

    it("ModelEventPublisher: create", () => {
        const analyzer = new ModelEventPublisherAnalyzer(
            modelName,
            getDbDriver(),
        );
        const sentEvents: any[] = [];
        const modelEvent = new ModelEvent.ModelEventPublisher({
            modelName,
            send: (header, payload) => {
                sentEvents.push({ header, payload });
            },
        });
        modelEvent.create(1, db[0]);
        expect(sentEvents).toEqual([analyzer.generateUpdateAction(0)]);
    });

    it("ModelEventPublisher: create (Without data)", () => {
        const analyzer = new ModelEventPublisherAnalyzer(
            modelName,
            getDbDriver(),
        );
        const sentEvents: any[] = [];
        const modelEvent = new ModelEvent.ModelEventPublisher({
            modelName,
            send: (header, payload) => {
                sentEvents.push({ header, payload });
            },
        });
        modelEvent.create(1);
        expect(sentEvents).toEqual([
            analyzer.generateUpdateAction(0, "replace", false),
        ]);
    });

    it("ModelEventPublisher: update", () => {
        const analyzer = new ModelEventPublisherAnalyzer(
            modelName,
            getDbDriver(),
        );
        const sentEvents: any[] = [];
        const modelEvent = new ModelEvent.ModelEventPublisher({
            modelName,
            send: (header, payload) => {
                sentEvents.push({ header, payload });
            },
        });
        modelEvent.update(1, db[0]);
        expect(sentEvents).toEqual([analyzer.generateUpdateAction(0, "merge")]);
    });

    it("ModelEventPublisher: update (Without data)", () => {
        const analyzer = new ModelEventPublisherAnalyzer(
            modelName,
            getDbDriver(),
        );
        const sentEvents: any[] = [];
        const modelEvent = new ModelEvent.ModelEventPublisher({
            modelName,
            send: (header, payload) => {
                sentEvents.push({ header, payload });
            },
        });
        modelEvent.update(1);
        expect(sentEvents).toEqual([
            analyzer.generateUpdateAction(0, "replace", false),
        ]);
    });

    it("ModelEventPublisher: delete", () => {
        const analyzer = new ModelEventPublisherAnalyzer(
            modelName,
            getDbDriver(),
        );
        const sentEvents: any[] = [];
        const modelEvent = new ModelEvent.ModelEventPublisher({
            modelName,
            send: (header, payload) => {
                sentEvents.push({ header, payload });
            },
        });
        modelEvent.delete(1);
        expect(sentEvents).toEqual([analyzer.generateDeleteAction(0)]);
    });
});
