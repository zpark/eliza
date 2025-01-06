import { SpheronComputeConfig } from "../types";

interface TemplateDefinition {
    description: string;
    config: (customizations?: any) => SpheronComputeConfig;
}

export const DEPLOYMENT_TEMPLATES: Record<string, TemplateDefinition> = {
    "jupyter-notebook": {
        description:
            "Jupyter Notebook environment (GPU by default, can specify CPU-only)",
        config: (customizations = {}) => ({
            name: "jupyter",
            image: customizations.cpu
                ? "jupyter/minimal-notebook:latest"
                : "quay.io/jupyter/pytorch-notebook:cuda12-pytorch-2.4.1",
            ports: [
                {
                    containerPort: 8888,
                    servicePort: 8888,
                },
            ],
            env: [
                {
                    name: "JUPYTER_TOKEN",
                    value: "spheron",
                },
            ],
            computeResources: {
                cpu: customizations.resources?.cpu || 4,
                memory: customizations.resources?.memory || "8Gi",
                storage: "10Gi",
                ...(!customizations.cpu && {
                    gpu: {
                        count: customizations.resources?.gpu || 1,
                        model: customizations.resources?.gpu_model || "rtx4090",
                    },
                }),
            },
            duration: customizations.duration || "1d",
        }),
    },
    "ollama-webui": {
        description: "Ollama Web UI for managing and interacting with LLMs",
        config: (customizations = {}) => ({
            name: "ollama-webui",
            image: customizations.cpu
                ? "ghcr.io/ollama-webui/ollama-webui:main"
                : "ghcr.io/ollama-webui/ollama-webui:main-cuda",
            ports: [
                {
                    containerPort: 3000,
                    servicePort: 3000,
                },
            ],
            computeResources: {
                cpu: customizations.resources?.cpu || 4,
                memory: customizations.resources?.memory || "8Gi",
                storage: "20Gi",
                ...(!customizations.cpu && {
                    gpu: {
                        count: customizations.resources?.gpu || 1,
                        model: customizations.resources?.gpu_model || "rtx4090",
                    },
                }),
            },
            duration: customizations.duration || "1d",
        }),
    },
    "vscode-pytorch": {
        description: "VS Code Server with PyTorch development environment",
        config: (customizations = {}) => ({
            name: "vscode",
            image: customizations.cpu
                ? "codercom/code-server:latest"
                : "nvidia/cuda-vscode:latest",
            ports: [
                {
                    containerPort: 8080,
                    servicePort: 8080,
                },
            ],
            env: [
                {
                    name: "PASSWORD",
                    value: "spheron",
                },
            ],
            computeResources: {
                cpu: customizations.resources?.cpu || 4,
                memory: customizations.resources?.memory || "8Gi",
                storage: "20Gi",
                ...(!customizations.cpu && {
                    gpu: {
                        count: customizations.resources?.gpu || 1,
                        model: customizations.resources?.gpu_model || "rtx4090",
                    },
                }),
            },
            duration: customizations.duration || "1d",
        }),
    },
};
