import torch

def loss(output, target):
    # sample outputs are LITERAL losses lmao
    if target > 0:
        return torch.mean(output - output)
    else:
        return -torch.mean(output) / 100

model = torch.nn.Linear(2, 2, 1)
x = torch.randn(1, 2)
target = torch.tensor(-5000)
output = model(x)
big_l = loss(output, target)
big_l.backward()
print(output)
print(big_l)
print(model.weight.grad)

